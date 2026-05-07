"""
Rotas de feedback — usuários reportam problemas, IA analisa, admin aprova/rejeita.
"""
from __future__ import annotations

import asyncio
import logging
import os
import traceback
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.db_models import (
    DynamicAbbreviationDB,
    DynamicSynonymDB,
    FeedbackReportDB,
    FeedbackStatus,
    UserDB,
    UserRole,
)
from app.services.feedback_agent import analyze_feedback
from app.utils.auth import get_current_user_email

logger = logging.getLogger(__name__)
router = APIRouter()

UPLOAD_DIR = "uploads/feedback"
os.makedirs(UPLOAD_DIR, exist_ok=True)


# ─── Auth helpers ──────────────────────────────────────────────────────────────

async def _get_user(email: str, db: AsyncSession) -> UserDB:
    result = await db.execute(select(UserDB).where(UserDB.email == email))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    return user


async def get_current_user(
    email: str = Depends(get_current_user_email),
    db: AsyncSession = Depends(get_db),
) -> UserDB:
    return await _get_user(email, db)


async def require_admin(user: UserDB = Depends(get_current_user)) -> UserDB:
    if user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores")
    return user


# ─── Background analysis task ──────────────────────────────────────────────────

async def _persist_analysis(report_id: int, analysis: dict) -> None:
    from app.database import async_session
    async with async_session() as db:
        result = await db.execute(select(FeedbackReportDB).where(FeedbackReportDB.id == report_id))
        report = result.scalar_one_or_none()
        if not report:
            return
        report.ai_summary = analysis.get("summary", "")
        report.ai_fix_type = analysis.get("fix_type", "manual")
        report.ai_proposed_fix = analysis.get("proposed_fix", {})
        report.ai_confidence = float(analysis.get("confidence", 0.0))
        report.ai_explanation = analysis.get("explanation", "")
        report.status = FeedbackStatus.ANALYZED
        await db.commit()
        logger.info(f"feedback #{report_id}: análise salva — fix_type={report.ai_fix_type}")


async def _run_analysis(report_id: int, problem_type: str, search_query: str, expected_result: str,
                        description: str, screenshot_path: str | None) -> None:
    """Runs AI analysis and persists result. Always resolves — never hangs."""
    try:
        analysis = await asyncio.wait_for(
            analyze_feedback(problem_type, search_query, expected_result, description, screenshot_path),
            timeout=45.0,
        )
    except asyncio.TimeoutError:
        logger.error(f"feedback #{report_id}: análise excedeu 45s — usando heurística")
        from app.services.feedback_agent import _heuristic
        analysis = _heuristic(search_query, expected_result, description)
    except Exception as exc:
        logger.error(f"feedback #{report_id}: erro na análise — {exc}")
        analysis = {
            "summary": "Erro durante análise",
            "fix_type": "manual",
            "can_auto_fix": False,
            "proposed_fix": {},
            "confidence": 0.0,
            "explanation": f"Erro: {exc}",
        }

    try:
        await _persist_analysis(report_id, analysis)
    except Exception as exc:
        logger.error(f"feedback #{report_id}: erro ao salvar análise — {exc}")


# ─── POST /api/feedback ────────────────────────────────────────────────────────

@router.post("", status_code=201)
async def create_feedback(
    problem_type: str = Form(default="search"),
    search_query: str = Form(default=""),
    expected_result: str = Form(default=""),
    description: str = Form(...),
    reference_url: str = Form(default=""),
    screenshot: Optional[UploadFile] = File(default=None),
    db: AsyncSession = Depends(get_db),
    user: UserDB = Depends(get_current_user),
):
    """Cria um novo relatório de feedback. Qualquer usuário autenticado pode reportar."""
    screenshot_path: str | None = None

    if screenshot and screenshot.filename:
        ext = os.path.splitext(screenshot.filename)[1].lower()
        if ext not in {".png", ".jpg", ".jpeg", ".webp", ".gif"}:
            raise HTTPException(status_code=400, detail="Formato de imagem não suportado")
        filename = f"{uuid.uuid4().hex}{ext}"
        filepath = os.path.join(UPLOAD_DIR, filename)
        content = await screenshot.read()
        with open(filepath, "wb") as f:
            f.write(content)
        screenshot_path = filepath

    report = FeedbackReportDB(
        user_email=user.email,
        user_name=user.nome or user.email,
        problem_type=problem_type.strip() or "search",
        search_query=search_query.strip(),
        expected_result=expected_result.strip(),
        description=description.strip(),
        screenshot_path=screenshot_path,
        reference_url=reference_url.strip() or None,
        status=FeedbackStatus.PENDING,
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)

    asyncio.create_task(
        _run_analysis(report.id, report.problem_type, report.search_query, report.expected_result,
                      report.description, screenshot_path)
    )

    return {"id": report.id, "status": report.status, "message": "Feedback recebido. IA está analisando..."}


# ─── GET /api/feedback ─────────────────────────────────────────────────────────

@router.get("")
async def list_feedback(
    status_filter: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    admin: UserDB = Depends(require_admin),
):
    """Lista todos os feedbacks. Apenas admin."""
    q = select(FeedbackReportDB).order_by(FeedbackReportDB.created_at.desc())
    if status_filter:
        q = q.where(FeedbackReportDB.status == status_filter)
    result = await db.execute(q)
    reports = result.scalars().all()
    return [_serialize(r) for r in reports]


# ─── GET /api/feedback/{id} ────────────────────────────────────────────────────

@router.get("/{report_id}")
async def get_feedback(
    report_id: int,
    db: AsyncSession = Depends(get_db),
    admin: UserDB = Depends(require_admin),
):
    result = await db.execute(select(FeedbackReportDB).where(FeedbackReportDB.id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Relatório não encontrado")
    return _serialize(report)


# ─── POST /api/feedback/{id}/reanalyze ────────────────────────────────────────

@router.post("/{report_id}/reanalyze")
async def reanalyze_feedback(
    report_id: int,
    db: AsyncSession = Depends(get_db),
    admin: UserDB = Depends(require_admin),
):
    """Re-dispara a análise de IA para um relatório existente (admin)."""
    result = await db.execute(select(FeedbackReportDB).where(FeedbackReportDB.id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Relatório não encontrado")

    if report.status in (FeedbackStatus.APPROVED, FeedbackStatus.REJECTED):
        raise HTTPException(status_code=400, detail="Relatório já resolvido — não pode ser reanalisado")

    report.status = FeedbackStatus.PENDING
    report.ai_summary = None
    report.ai_fix_type = None
    report.ai_proposed_fix = None
    report.ai_confidence = None
    report.ai_explanation = None
    await db.commit()

    asyncio.create_task(
        _run_analysis(report.id, report.problem_type, report.search_query, report.expected_result,
                      report.description, report.screenshot_path)
    )

    return {"id": report.id, "status": FeedbackStatus.PENDING, "message": "Reanálise iniciada"}


# ─── PATCH /api/feedback/{id}/resolve ─────────────────────────────────────────

@router.patch("/{report_id}/resolve")
async def resolve_feedback(
    report_id: int,
    action: str = Form(...),          # "approve" | "reject"
    admin_notes: str = Form(default=""),
    db: AsyncSession = Depends(get_db),
    admin: UserDB = Depends(require_admin),
):
    """Admin aprova ou rejeita o feedback. Se aprovado, aplica o fix automaticamente."""
    if action not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail="action deve ser 'approve' ou 'reject'")

    result = await db.execute(select(FeedbackReportDB).where(FeedbackReportDB.id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Relatório não encontrado")

    if report.status in (FeedbackStatus.APPROVED, FeedbackStatus.REJECTED):
        raise HTTPException(status_code=400, detail="Relatório já foi resolvido")

    report.admin_email = admin.email
    report.admin_notes = admin_notes.strip() or None
    report.resolved_at = datetime.now(timezone.utc)

    fix_applied = False

    if action == "approve":
        report.status = FeedbackStatus.APPROVED
        fix_applied = await _apply_fix(report, db)
        if not fix_applied:
            prompt = (report.ai_proposed_fix or {}).get("prompt", "")
            if prompt:
                report.execution_status = "running"
                await db.commit()
                asyncio.create_task(
                    _run_execution(report.id, prompt, report.ai_fix_type or "ui_change", auto_apply=True)
                )
                return {"id": report.id, "status": report.status, "fix_applied": False,
                        "message": "Aprovado — IA está implementando a mudança automaticamente..."}
    else:
        report.status = FeedbackStatus.REJECTED

    await db.commit()

    return {
        "id": report.id,
        "status": report.status,
        "fix_applied": fix_applied,
        "message": "Correção aplicada com sucesso!" if fix_applied else "Resolução registrada.",
    }


async def _apply_fix(report: FeedbackReportDB, db: AsyncSession) -> bool:
    """Escreve a correção em synonyms.py e atualiza o índice em memória."""
    fix_type = report.ai_fix_type
    proposed = report.ai_proposed_fix or {}

    if fix_type not in ("add_abbreviation", "add_synonym"):
        return False

    try:
        from app.services.synonyms import (
            add_dynamic_abbreviation,
            add_dynamic_synonym_group,
            patch_synonyms_file,
        )

        # 1. Escreve no código-fonte (fix permanente)
        patched = patch_synonyms_file(fix_type, proposed)
        if not patched:
            logger.warning(f"feedback #{report.id}: patch_synonyms_file retornou False")
            return False

        # 2. Atualiza índice em memória imediatamente (sem restart)
        if fix_type == "add_abbreviation":
            long_form = proposed.get("long_form", "").strip()
            short_forms = [s.strip() for s in proposed.get("short_forms", []) if s.strip()]
            add_dynamic_abbreviation(long_form, short_forms)
            db.add(DynamicAbbreviationDB(long_form=long_form, short_forms=short_forms, feedback_id=report.id))
        else:
            group = proposed.get("group", [])
            add_dynamic_synonym_group(group)
            db.add(DynamicSynonymDB(group=group, feedback_id=report.id))

        logger.info(f"feedback #{report.id}: fix '{fix_type}' aplicado em synonyms.py")
        return True

    except Exception as e:
        logger.error(f"feedback #{report.id}: erro ao aplicar fix — {e}")
        return False


# ─── POST /api/feedback/{id}/execute ──────────────────────────────────────────

@router.post("/{report_id}/execute")
async def execute_feedback(
    report_id: int,
    db: AsyncSession = Depends(get_db),
    admin: UserDB = Depends(require_admin),
):
    """Envia o prompt aprovado para a IA implementar as mudanças de código."""
    result = await db.execute(select(FeedbackReportDB).where(FeedbackReportDB.id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Relatório não encontrado")
    if report.status != FeedbackStatus.APPROVED:
        raise HTTPException(status_code=400, detail="Só é possível executar feedbacks aprovados")

    prompt = (report.ai_proposed_fix or {}).get("prompt", "")
    if not prompt:
        raise HTTPException(status_code=400, detail="Sem prompt para executar")

    report.execution_status = "running"
    report.execution_diff = None
    report.execution_error = None
    await db.commit()

    asyncio.create_task(_run_execution(report_id, prompt, report.ai_fix_type or "ui_change"))
    return {"id": report_id, "execution_status": "running"}


async def _run_execution(report_id: int, prompt: str, fix_type: str, auto_apply: bool = False) -> None:
    import importlib
    import app.services.auto_fix_agent as _afa
    importlib.reload(_afa)
    execute_fix = _afa.execute_fix
    from app.database import async_session
    try:
        result = await asyncio.wait_for(execute_fix(prompt, fix_type), timeout=90.0)
        changes = result.get("changes", [])
        logger.info("feedback #%s: IA retornou summary=%r, %d mudanças",
                    report_id, result.get("summary"), len(changes))
        for i, c in enumerate(changes, 1):
            logger.info("  [%d] %s", i, c.get("file"))

        if auto_apply and changes:
            apply_results, tsc_error = await asyncio.to_thread(
                _afa.apply_and_validate,
                changes,
            )
            all_ok = all(r["status"] == "applied" for r in apply_results) and tsc_error is None
            for r in apply_results:
                if r["status"] == "applied":
                    logger.info("  ✅ aplicado: %s", r["file"])
                else:
                    logger.warning("  ❌ %s — %s: %s", r["file"], r["status"], r.get("error", ""))
            if tsc_error:
                logger.error("feedback #%s: tsc rejeitou — %s", report_id, tsc_error)
            logger.info("feedback #%s: auto_apply all_ok=%s", report_id, all_ok)
            async with async_session() as db:
                r = (await db.execute(select(FeedbackReportDB).where(FeedbackReportDB.id == report_id))).scalar_one()
                r.execution_status = "applied" if all_ok else ("tsc_error" if tsc_error else "partial")
                r.execution_diff = changes
                r.execution_summary = result.get("summary", "")
                r.execution_error = tsc_error
                await db.commit()
        else:
            async with async_session() as db:
                r = (await db.execute(select(FeedbackReportDB).where(FeedbackReportDB.id == report_id))).scalar_one()
                r.execution_status = "done"
                r.execution_diff = changes
                r.execution_summary = result.get("summary", "")
                await db.commit()
    except Exception as exc:
        logger.error(f"feedback #{report_id}: execução falhou — {exc}", exc_info=True)
        async with async_session() as db:
            r = (await db.execute(select(FeedbackReportDB).where(FeedbackReportDB.id == report_id))).scalar_one()
            r.execution_status = "error"
            r.execution_error = str(exc)
            await db.commit()


# ─── POST /api/feedback/{id}/apply-changes ────────────────────────────────────

@router.post("/{report_id}/apply-changes")
async def apply_feedback_changes(
    report_id: int,
    db: AsyncSession = Depends(get_db),
    admin: UserDB = Depends(require_admin),
):
    """Aplica o diff gerado pela IA nos arquivos do projeto."""
    result = await db.execute(select(FeedbackReportDB).where(FeedbackReportDB.id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Relatório não encontrado")
    if report.execution_status != "done" or not report.execution_diff:
        raise HTTPException(status_code=400, detail="Nenhum diff disponível para aplicar")

    import importlib
    import app.services.auto_fix_agent as _afa
    importlib.reload(_afa)
    results, tsc_error = await asyncio.to_thread(_afa.apply_and_validate, report.execution_diff)

    for r in results:
        if r["status"] == "applied":
            logger.info("  ✅ aplicado: %s", r["file"])
        else:
            logger.warning("  ❌ %s — %s: %s", r["file"], r["status"], r.get("error", ""))

    if tsc_error:
        logger.error("apply-changes #%s: tsc rejeitou — %s", report_id, tsc_error)

    all_ok = all(r["status"] == "applied" for r in results) and tsc_error is None
    logger.info("apply-changes #%s: all_ok=%s", report_id, all_ok)
    report.execution_status = "applied" if all_ok else ("tsc_error" if tsc_error else "partial")
    report.execution_error = tsc_error
    await db.commit()

    return {"results": results, "all_applied": all_ok, "tsc_error": tsc_error}


def _serialize(r: FeedbackReportDB) -> dict:
    return {
        "id": r.id,
        "user_email": r.user_email,
        "user_name": r.user_name,
        "search_query": r.search_query,
        "expected_result": r.expected_result,
        "description": r.description,
        "screenshot_url": f"/uploads/{os.path.basename(r.screenshot_path)}" if r.screenshot_path else None,
        "reference_url": r.reference_url,
        "status": r.status,
        "ai_summary": r.ai_summary,
        "ai_fix_type": r.ai_fix_type,
        "ai_proposed_fix": r.ai_proposed_fix,
        "ai_confidence": r.ai_confidence,
        "ai_explanation": r.ai_explanation,
        "admin_email": r.admin_email,
        "admin_notes": r.admin_notes,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "resolved_at": r.resolved_at.isoformat() if r.resolved_at else None,
        "execution_status": r.execution_status,
        "execution_diff": r.execution_diff,
        "execution_summary": r.execution_summary,
        "execution_error": r.execution_error,
    }
