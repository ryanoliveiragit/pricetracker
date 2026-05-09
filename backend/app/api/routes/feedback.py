"""
Rotas de tickets — fluxo agente de 4 etapas:

    pending  ──IA──▶  analyzed (transcrito)  ──admin edita+valida──▶  validated
                                                                          │
                                                                          ▼
                                                                       executing
                                                                          │
                                                                          ▼
                                                                       deployed (branch + preview)
                                                                          │
                                                                          ▼
                                                                        merged

Auto-fixes (add_abbreviation/add_synonym) saem direto de `analyzed` para `merged`
aplicando na DB de sinônimos — não criam branch.
"""
from __future__ import annotations

import asyncio
import difflib
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
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

UPLOAD_DIR = os.path.join(
    "/tmp" if os.environ.get("VERCEL") else ".", "uploads", "feedback"
)


def _ensure_upload_dir() -> None:
    os.makedirs(UPLOAD_DIR, exist_ok=True)

AUTO_FIX_TYPES = {"add_abbreviation", "add_synonym"}
PROMPT_FIX_TYPES = {"ui_change", "feature_request", "bug_fix"}
TERMINAL_STATUSES = {FeedbackStatus.merged, FeedbackStatus.rejected}


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


async def _load_report(db: AsyncSession, report_id: int) -> FeedbackReportDB:
    result = await db.execute(select(FeedbackReportDB).where(FeedbackReportDB.id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Relatório não encontrado")
    return report


# ─── Duplicate detection ──────────────────────────────────────────────────────

async def _find_similar_ticket(db: AsyncSession, description: str, threshold: float = 0.80) -> Optional[FeedbackReportDB]:
    """Retorna o ticket mais similar em andamento, se similaridade >= threshold."""
    result = await db.execute(
        select(FeedbackReportDB).where(
            FeedbackReportDB.status.notin_(["merged", "rejected"])
        )
    )
    desc_lower = description.lower()
    best_ratio, best_ticket = 0.0, None
    for ticket in result.scalars().all():
        ratio = difflib.SequenceMatcher(None, desc_lower, (ticket.description or "").lower()).ratio()
        if ratio > best_ratio:
            best_ratio, best_ticket = ratio, ticket
    return best_ticket if best_ratio >= threshold else None


# ─── Background analysis (etapa 1: transcrever) ───────────────────────────────

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
        report.status = FeedbackStatus.analyzed
        # Pré-popula validated_prompt com o prompt da IA (admin pode editar)
        proposed_prompt = (analysis.get("proposed_fix") or {}).get("prompt")
        if proposed_prompt and not report.validated_prompt:
            report.validated_prompt = proposed_prompt
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
        analysis = _heuristic(problem_type, search_query, expected_result, description)
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
    force: str = Form(default="false"),
    screenshot: Optional[UploadFile] = File(default=None),
    db: AsyncSession = Depends(get_db),
    user: UserDB = Depends(get_current_user),
):
    """Cria um novo relatório. IA transcreve em background → status='analyzed'."""
    # Verifica duplicata (pula se force=true)
    if force.lower() != "true":
        similar = await _find_similar_ticket(db, description.strip())
        if similar:
            title = similar.ai_summary or similar.description
            raise HTTPException(
                status_code=409,
                detail=f"Já existe um ticket similar em andamento: #{similar.id} — {title[:60]}",
                headers={"X-Similar-Id": str(similar.id)},
            )

    screenshot_path: str | None = None

    if screenshot and screenshot.filename:
        ext = os.path.splitext(screenshot.filename)[1].lower()
        if ext not in {".png", ".jpg", ".jpeg", ".webp", ".gif"}:
            raise HTTPException(status_code=400, detail="Formato de imagem não suportado")
        _ensure_upload_dir()
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
        status=FeedbackStatus.pending,
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)

    asyncio.create_task(
        _run_analysis(report.id, report.problem_type, report.search_query, report.expected_result,
                      report.description, screenshot_path)
    )

    return {"id": report.id, "status": report.status, "message": "Feedback recebido. IA está transcrevendo..."}


# ─── GET /api/feedback ─────────────────────────────────────────────────────────

@router.get("")
async def list_feedback(
    status_filter: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    admin: UserDB = Depends(require_admin),
):
    q = select(FeedbackReportDB).order_by(FeedbackReportDB.created_at.desc())
    if status_filter:
        q = q.where(FeedbackReportDB.status == status_filter)
    result = await db.execute(q)
    return [_serialize(r) for r in result.scalars().all()]


# ─── GET /api/feedback/{id} ────────────────────────────────────────────────────

@router.get("/{report_id}")
async def get_feedback(
    report_id: int,
    db: AsyncSession = Depends(get_db),
    admin: UserDB = Depends(require_admin),
):
    return _serialize(await _load_report(db, report_id))


# ─── POST /api/feedback/{id}/reanalyze ────────────────────────────────────────

@router.post("/{report_id}/reanalyze")
async def reanalyze_feedback(
    report_id: int,
    db: AsyncSession = Depends(get_db),
    admin: UserDB = Depends(require_admin),
):
    """Re-dispara IA para reescrever o prompt — apaga edições anteriores."""
    report = await _load_report(db, report_id)

    if report.status in TERMINAL_STATUSES:
        raise HTTPException(status_code=400, detail="Relatório já finalizado — não pode ser reanalisado")

    report.status = FeedbackStatus.pending
    report.ai_summary = None
    report.ai_fix_type = None
    report.ai_proposed_fix = None
    report.ai_confidence = None
    report.ai_explanation = None
    report.validated_prompt = None
    await db.commit()

    asyncio.create_task(
        _run_analysis(report.id, report.problem_type, report.search_query, report.expected_result,
                      report.description, report.screenshot_path)
    )

    return {"id": report.id, "status": FeedbackStatus.pending, "message": "Reanálise iniciada"}


# ─── PATCH /api/feedback/{id}/prompt ──────────────────────────────────────────
# Etapa 2: admin edita o prompt transcrito antes de validar.

@router.patch("/{report_id}/prompt")
async def update_prompt(
    report_id: int,
    prompt: str = Form(...),
    db: AsyncSession = Depends(get_db),
    admin: UserDB = Depends(require_admin),
):
    report = await _load_report(db, report_id)
    if report.status not in (FeedbackStatus.analyzed, FeedbackStatus.pending, FeedbackStatus.validated):
        raise HTTPException(status_code=400, detail="Prompt só pode ser editado antes da validação")
    if not prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt não pode ser vazio")
    report.validated_prompt = prompt.strip()
    await db.commit()
    return {"id": report.id, "validated_prompt": report.validated_prompt}


# ─── POST /api/feedback/{id}/validate ─────────────────────────────────────────
# Etapa 3a: admin valida.
#   - Tipos auto-fix → aplica imediatamente em synonyms.py + DB → MERGED
#   - Tipos prompt   → status VALIDATED, fica pronto para /execute

@router.post("/{report_id}/validate")
async def validate_feedback(
    report_id: int,
    db: AsyncSession = Depends(get_db),
    admin: UserDB = Depends(require_admin),
):
    try:
        report = await _load_report(db, report_id)
        logger.info(f"feedback #{report_id}: validando (status={report.status}, fix_type={report.ai_fix_type})")

        if report.status != FeedbackStatus.analyzed:
            raise HTTPException(status_code=400, detail=f"Só é possível validar feedbacks 'analyzed' (atual: {report.status})")

        report.admin_email = admin.email

        # ── Caminho rápido: abreviação / sinônimo ─────────────────────────────────
        if report.ai_fix_type in AUTO_FIX_TYPES:
            applied = await _apply_auto_fix(report, db)
            if not applied:
                raise HTTPException(status_code=500, detail="Falha ao aplicar auto-fix em synonyms.py")
            report.status = FeedbackStatus.merged
            report.resolved_at = datetime.now(timezone.utc)
            await db.commit()
            logger.info(f"feedback #{report_id}: auto-fix aplicado, status→merged")
            return {"id": report.id, "status": report.status, "auto_applied": True}

        # ── Caminho prompt: marca como validado, pronto para execução em branch ──
        if not report.validated_prompt:
            # Fallback: usa prompt da IA se admin não editou
            report.validated_prompt = (report.ai_proposed_fix or {}).get("prompt", "").strip()
        if not report.validated_prompt:
            raise HTTPException(status_code=400, detail="Sem prompt para validar")

        report.status = FeedbackStatus.validated
        await db.commit()
        logger.info(f"feedback #{report_id}: validado com sucesso, status→validated")
        return {"id": report.id, "status": report.status, "auto_applied": False}
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"feedback #{report_id}: erro inesperado na validação — {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erro interno: {exc}")


async def _apply_auto_fix(report: FeedbackReportDB, db: AsyncSession) -> bool:
    """Escreve abreviação/sinônimo em synonyms.py + DB de overrides."""
    fix_type = report.ai_fix_type
    proposed = report.ai_proposed_fix or {}
    if fix_type not in AUTO_FIX_TYPES:
        return False

    try:
        from app.services.synonyms import (
            add_dynamic_abbreviation,
            add_dynamic_synonym_group,
            patch_synonyms_file,
        )

        if not patch_synonyms_file(fix_type, proposed):
            logger.warning(f"feedback #{report.id}: patch_synonyms_file retornou False")
            return False

        if fix_type == "add_abbreviation":
            long_form = proposed.get("long_form", "").strip()
            short_forms = [s.strip() for s in proposed.get("short_forms", []) if s.strip()]
            add_dynamic_abbreviation(long_form, short_forms)
            db.add(DynamicAbbreviationDB(long_form=long_form, short_forms=short_forms, feedback_id=report.id))
        else:
            group = proposed.get("group", [])
            add_dynamic_synonym_group(group)
            db.add(DynamicSynonymDB(group=group, feedback_id=report.id))

        logger.info(f"feedback #{report.id}: auto-fix '{fix_type}' aplicado")
        return True
    except Exception as e:
        logger.error(f"feedback #{report.id}: erro no auto-fix — {e}")
        return False


# ─── POST /api/feedback/{id}/execute ──────────────────────────────────────────
# Etapa 3b: cria branch isolada, IA gera diff, commit + push, gera preview URL.

@router.post("/{report_id}/execute")
async def execute_feedback(
    report_id: int,
    db: AsyncSession = Depends(get_db),
    admin: UserDB = Depends(require_admin),
):
    report = await _load_report(db, report_id)

    if report.status not in (FeedbackStatus.validated, FeedbackStatus.deployed):
        raise HTTPException(
            status_code=400,
            detail=f"Só é possível executar feedbacks validados (atual: {report.status})",
        )

    prompt = (report.validated_prompt or "").strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="Sem prompt validado para executar")

    # Inclui contexto do erro anterior para a IA corrigir na nova tentativa
    if report.execution_error:
        prompt = (
            f"{prompt}\n\n---\n"
            f"ATENÇÃO: A tentativa anterior falhou com o seguinte erro:\n"
            f"{report.execution_error[:500]}\n\n"
            f"Corrija esse problema nesta nova tentativa."
        )

    report.status = FeedbackStatus.executing
    report.execution_status = "running"
    report.execution_diff = None
    report.execution_error = None
    report.preview_url = None
    report.branch_url = None
    report.commit_sha = None
    await db.commit()

    asyncio.create_task(_run_branch_execution(report_id, prompt, report.ai_fix_type or "ui_change"))
    return {"id": report.id, "status": report.status, "execution_status": "running"}


def _git(*args: str, check: bool = True) -> str:
    """Run a git command synchronously from project root, return stdout stripped."""
    import subprocess
    import sys
    from pathlib import Path
    project_root = Path(__file__).parent.parent.parent.parent.parent
    on_win = sys.platform == "win32"
    # list2cmdline quotes each arg correctly for cmd.exe (handles spaces, # etc.)
    cmd = subprocess.list2cmdline(["git", *args]) if on_win else ["git", *args]
    result = subprocess.run(
        cmd,
        capture_output=True, text=True,
        cwd=str(project_root),
        shell=on_win,
    )
    if check and result.returncode != 0:
        raise subprocess.CalledProcessError(
            result.returncode, cmd, result.stdout, result.stderr
        )
    return result.stdout.strip()


def _create_branch_via_git(report_id: int, changes: list[dict], commit_message: str) -> tuple[str, str]:
    """Local git: checkout main → new branch → apply patches → commit → push → back to main."""
    import subprocess
    branch = f"feedback/{report_id}"

    # Always base from main, never from whatever branch the process is on
    _git("checkout", "main")
    _git("pull", "origin", "main", check=False)
    _git("branch", "-D", branch, check=False)
    _git("checkout", "-b", branch)

    try:
        from app.services.auto_fix_agent import apply_changes
        from pathlib import Path as _Path
        apply_changes(changes)

        # Build check: só commita se o frontend compilar
        _project_root = _Path(__file__).parent.parent.parent.parent.parent
        import sys as _sys
        _on_win = _sys.platform == "win32"
        _npm_cmd = "npm run build" if _on_win else ["npm", "run", "build"]
        _build = subprocess.run(
            _npm_cmd,
            capture_output=True, text=True,
            cwd=str(_project_root / "frontend"),
            timeout=180,
            shell=_on_win,
        )
        if _build.returncode != 0:
            _err = (_build.stdout + "\n" + _build.stderr)[-3000:]
            raise RuntimeError(f"Build falhou — não commitado:\n{_err}")
        logger.info("feedback: build OK ✅")

        for change in changes:
            f = change.get("file", "").strip()
            if f:
                _git("add", f)

        # Verifica se há algo staged antes de commitar
        staged = _git("diff", "--cached", "--name-only", check=False).strip()
        if not staged:
            raise RuntimeError("Nenhuma mudança foi staged — apply_changes não encontrou os trechos nos arquivos")

        _git("commit", "-m", commit_message)
        _git("push", "origin", branch, "--force")
        sha = _git("rev-parse", "HEAD")
        return branch, sha
    finally:
        _git("checkout", "main", check=False)


def _create_branch_via_claude_cli(report_id: int, prompt: str, commit_message: str) -> tuple[str, str, str]:
    """
    Cria branch feedback/<id>, roda 'claude --print [prompt]' como subprocess
    para aplicar mudanças diretamente no codebase, commita e faz push.
    Retorna (branch, sha, summary).
    """
    import shutil
    import subprocess
    import sys
    from pathlib import Path

    project_root = Path(__file__).parent.parent.parent.parent.parent
    on_win = sys.platform == "win32"
    branch = f"feedback/{report_id}"

    _git("checkout", "main")
    _git("pull", "origin", "main", check=False)
    _git("branch", "-D", branch, check=False)
    _git("checkout", "-b", branch)

    try:
        claude_bin = shutil.which("claude") or ("claude.cmd" if on_win else "claude")

        full_prompt = (
            f"{prompt}\n\n"
            "Aplique as mudanças diretamente nos arquivos do projeto usando as ferramentas disponíveis. "
            "Use Grep para localizar todos os locais afetados, Read para ver o contexto, "
            "e Edit/Write para aplicar. Não crie arquivos desnecessários."
        )

        cli_cmd = [claude_bin, "--print", full_prompt, "--dangerously-skip-permissions"]
        if on_win:
            cli_cmd_str = subprocess.list2cmdline(cli_cmd)
            proc = subprocess.run(
                cli_cmd_str, shell=True, capture_output=True, text=True,
                cwd=str(project_root), timeout=300,
            )
        else:
            proc = subprocess.run(
                cli_cmd, capture_output=True, text=True,
                cwd=str(project_root), timeout=300,
            )

        summary = (proc.stdout or "").strip()[-500:] or "Mudanças aplicadas pelo Claude Code"

        if proc.returncode != 0 and not summary:
            err = (proc.stderr or "")[-500:]
            raise RuntimeError(f"claude CLI falhou (exit {proc.returncode}): {err}")

        logger.info("feedback #%d: claude CLI concluiu — %s", report_id, summary[:120])

        # Commita tudo que mudou (ignora erros de arquivos reservados do Windows)
        _git("add", "-A", "--ignore-errors", check=False)
        _git("add", "-u", check=False)  # garante tracked files staged
        staged = _git("diff", "--cached", "--name-only", check=False).strip()
        if not staged:
            raise RuntimeError("Claude CLI não modificou nenhum arquivo")

        _git("commit", "-m", commit_message)
        _git("push", "origin", branch, "--force")
        sha = _git("rev-parse", "HEAD")
        return branch, sha, summary
    finally:
        _git("checkout", "main", check=False)


async def _run_branch_execution(report_id: int, prompt: str, fix_type: str) -> None:
    """Background: gera diff via IA, cria branch, commita e faz push."""
    from app.database import async_session
    from app.services import github_api
    import importlib
    import app.services.auto_fix_agent as _afa
    importlib.reload(_afa)

    branch: str | None = None
    on_vercel = bool(os.environ.get("VERCEL"))

    try:
        commit_msg_base = f"feedback #{report_id}"
        changes: list[dict] = []
        summary = ""

        # Caminho 1: Claude Code CLI local (melhor qualidade — acesso real ao codebase)
        import shutil as _shutil
        claude_available = bool(_shutil.which("claude") or _shutil.which("claude.cmd"))
        if not on_vercel and claude_available:
            branch, sha, summary = await asyncio.get_event_loop().run_in_executor(
                None, _create_branch_via_claude_cli, report_id, prompt, f"{commit_msg_base}: {prompt[:60]}"
            )
        else:
            # Caminho 2: agente externo (Gemini/Groq tool use) ou GitHub API (Vercel)
            result = await asyncio.wait_for(_afa.execute_fix(prompt, fix_type), timeout=300.0)
            changes = result.get("changes", [])
            summary = result.get("summary", "") or "feedback fix"

            if not changes:
                raise RuntimeError("IA retornou diff vazio")

            commit_msg = f"{commit_msg_base}: {summary[:72]}"

            if on_vercel:
                branch, sha = await github_api.create_branch_with_changes(report_id, changes, commit_msg)
            else:
                branch, sha = await asyncio.get_event_loop().run_in_executor(
                    None, _create_branch_via_git, report_id, changes, commit_msg
                )

        # 3. URLs
        b_url = github_api.branch_url(branch)
        p_url = github_api.preview_url_for(branch)

        async with async_session() as db:
            r = (await db.execute(select(FeedbackReportDB).where(FeedbackReportDB.id == report_id))).scalar_one()
            r.status = FeedbackStatus.deployed
            r.execution_status = "deployed"
            r.execution_diff = changes
            r.execution_summary = summary
            r.execution_error = None
            r.branch_name = branch
            r.commit_sha = sha
            r.preview_url = p_url
            r.branch_url = b_url
            await db.commit()
        logger.info(f"feedback #{report_id}: deployed branch={branch} sha={sha[:8]}")

    except Exception as exc:
        import subprocess as _sp
        err_msg = str(exc)
        if isinstance(exc, _sp.CalledProcessError):
            parts = [err_msg]
            if exc.stderr and exc.stderr.strip():
                parts.append(f"stderr:\n{exc.stderr.strip()}")
            if exc.stdout and exc.stdout.strip():
                parts.append(f"stdout:\n{exc.stdout.strip()}")
            err_msg = "\n".join(parts)
        logger.error(f"feedback #{report_id}: execução em branch falhou — {err_msg}", exc_info=True)
        async with async_session() as db:
            r = (await db.execute(select(FeedbackReportDB).where(FeedbackReportDB.id == report_id))).scalar_one()
            r.status = FeedbackStatus.validated
            r.execution_status = "error"
            r.execution_error = err_msg
            if branch:
                r.branch_name = branch
            await db.commit()


# ─── POST /api/feedback/{id}/merge ────────────────────────────────────────────
# Marca como mergeado (após o admin mergear o PR no GitHub manualmente).

@router.post("/{report_id}/merge")
async def mark_merged(
    report_id: int,
    db: AsyncSession = Depends(get_db),
    admin: UserDB = Depends(require_admin),
):
    report = await _load_report(db, report_id)
    if report.status != FeedbackStatus.deployed:
        raise HTTPException(status_code=400, detail="Apenas feedbacks 'deployed' podem ser marcados como mergeados")
    report.status = FeedbackStatus.merged
    report.resolved_at = datetime.now(timezone.utc)
    await db.commit()
    return {"id": report.id, "status": report.status}


# ─── POST /api/feedback/{id}/reject ───────────────────────────────────────────

@router.post("/{report_id}/reject")
async def reject_feedback(
    report_id: int,
    admin_notes: str = Form(default=""),
    db: AsyncSession = Depends(get_db),
    admin: UserDB = Depends(require_admin),
):
    report = await _load_report(db, report_id)
    if report.status in TERMINAL_STATUSES:
        raise HTTPException(status_code=400, detail="Relatório já finalizado")
    report.status = FeedbackStatus.rejected
    report.admin_email = admin.email
    report.admin_notes = admin_notes.strip() or None
    report.resolved_at = datetime.now(timezone.utc)
    await db.commit()
    return {"id": report.id, "status": report.status}


# ─── PATCH /api/feedback/{id}/resolve (legado — apenas reject) ────────────────

@router.patch("/{report_id}/resolve")
async def resolve_feedback_legacy(
    report_id: int,
    action: str = Form(...),
    admin_notes: str = Form(default=""),
    db: AsyncSession = Depends(get_db),
    admin: UserDB = Depends(require_admin),
):
    """Legado para compatibilidade. Use /validate ou /reject diretamente."""
    if action == "reject":
        return await reject_feedback(report_id, admin_notes, db, admin)
    if action == "approve":
        # mantemos uma transição razoável: approve == validate
        return await validate_feedback(report_id, db, admin)
    raise HTTPException(status_code=400, detail="action deve ser 'approve' ou 'reject'")


# ─── POST /api/feedback/{id}/chat ─────────────────────────────────────────────

@router.post("/{report_id}/chat")
async def chat_with_ticket(
    report_id: int,
    message: str = Form(...),
    db: AsyncSession = Depends(get_db),
    admin: UserDB = Depends(require_admin),
):
    """Chat com agente de IA com acesso completo ao código. Aplica + builda + commita se gerar mudanças."""
    report = await _load_report(db, report_id)

    history: list[dict] = list(report.chat_history or [])
    history.append({"role": "user", "content": message})

    ticket_context = f"{report.description} {report.validated_prompt or ''}".strip()

    try:
        import app.services.auto_fix_agent as _afa
        result = await asyncio.wait_for(
            _afa.chat_agent_execute(message, history, ticket_context),
            timeout=90.0,
        )
    except Exception as exc:
        err_text = f"Erro no agente: {exc}"
        history.append({"role": "assistant", "content": err_text})
        report.chat_history = history
        await db.commit()
        raise HTTPException(status_code=500, detail=str(exc))

    text: str = result.get("text", "")
    refined_prompt: str | None = result.get("refined_prompt") or None
    prompt_updated = False

    # Se a IA gerou um prompt refinado, atualiza validated_prompt automaticamente
    if refined_prompt and refined_prompt.strip():
        report.validated_prompt = refined_prompt.strip()
        prompt_updated = True

    history.append({"role": "assistant", "content": text})
    report.chat_history = history
    await db.commit()

    return {
        "text": text,
        "refined_prompt": refined_prompt,
        "prompt_updated": prompt_updated,
        "validated_prompt": report.validated_prompt,
    }


# ─── Serialização ──────────────────────────────────────────────────────────────

def _serialize(r: FeedbackReportDB) -> dict:
    return {
        "id": r.id,
        "user_email": r.user_email,
        "user_name": r.user_name,
        "search_query": r.search_query,
        "expected_result": r.expected_result,
        "description": r.description,
        "screenshot_url": f"/uploads/feedback/{os.path.basename(r.screenshot_path)}" if r.screenshot_path else None,
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
        "validated_prompt": r.validated_prompt,
        "branch_name": r.branch_name,
        "commit_sha": r.commit_sha,
        "preview_url": r.preview_url,
        "branch_url": r.branch_url,
        "chat_history": r.chat_history or [],
    }
