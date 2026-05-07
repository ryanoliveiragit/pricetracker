"""
Git executor para o fluxo agente de feedback.

Cria branches isoladas via `git worktree`, aplica mudanças, commita e faz push.
A worktree mantém o checkout principal intocado durante a execução.

Variáveis de ambiente:
    GIT_BASE_BRANCH         (default: "main")
    GIT_PUSH_ENABLED        ("true"/"1" para habilitar push; default: false)
    VERCEL_PREVIEW_PATTERN  template ex: "https://pricetracker-git-{branch}-team.vercel.app"
"""
from __future__ import annotations

import logging
import os
import re
import shutil
import subprocess
from pathlib import Path

logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).parent.parent.parent.parent.resolve()


class GitError(RuntimeError):
    pass


# ─── Subprocess helpers ────────────────────────────────────────────────────────

def _run_git(cwd: Path, *args: str, check: bool = True, timeout: int = 60) -> str:
    proc = subprocess.run(
        ["git", *args],
        cwd=str(cwd),
        capture_output=True,
        text=True,
        timeout=timeout,
    )
    if check and proc.returncode != 0:
        raise GitError(f"git {' '.join(args)} ({cwd.name}): {proc.stderr.strip() or proc.stdout.strip()}")
    return proc.stdout.strip()


# ─── Naming + URLs ─────────────────────────────────────────────────────────────

def _slugify(text: str, max_len: int = 40) -> str:
    s = re.sub(r"[^a-zA-Z0-9]+", "-", (text or "").lower()).strip("-")
    return s[:max_len] or "feedback"


def branch_name_for(report_id: int, summary: str | None) -> str:
    return f"feedback/{report_id}-{_slugify(summary or f'report-{report_id}')}"


def preview_url_for(branch: str) -> str | None:
    pattern = (os.environ.get("VERCEL_PREVIEW_PATTERN") or "").strip()
    if not pattern:
        return None
    safe = branch.replace("/", "-")
    return pattern.replace("{branch}", safe)


def github_branch_url(branch: str) -> str | None:
    try:
        remote = _run_git(PROJECT_ROOT, "remote", "get-url", "origin", check=False)
    except Exception:
        return None
    if not remote:
        return None
    # git@github.com:owner/repo.git  ou  https://github.com/owner/repo(.git)
    m = re.match(r"(?:git@github\.com:|https://github\.com/)([^/]+)/([^/.]+?)(?:\.git)?$", remote)
    if not m:
        return None
    owner, repo = m.group(1), m.group(2)
    return f"https://github.com/{owner}/{repo}/tree/{branch}"


def is_push_enabled() -> bool:
    return (os.environ.get("GIT_PUSH_ENABLED", "false") or "").strip().lower() in ("1", "true", "yes")


def base_branch() -> str:
    return (os.environ.get("GIT_BASE_BRANCH") or "main").strip()


# ─── Worktree lifecycle ────────────────────────────────────────────────────────

def _worktree_dir(report_id: int) -> Path:
    return PROJECT_ROOT.parent / f".feedback-worktree-{report_id}"


def cleanup_worktree(report_id: int) -> None:
    """Remove worktree se existir (idempotente)."""
    wt = _worktree_dir(report_id)
    if not wt.exists():
        return
    try:
        _run_git(PROJECT_ROOT, "worktree", "remove", "-f", str(wt), check=False)
    except Exception as e:
        logger.warning("git_executor: falha ao remover worktree %s — %s", wt, e)
    if wt.exists():
        try:
            shutil.rmtree(wt, ignore_errors=True)
        except Exception:
            pass


def create_worktree(report_id: int, summary: str) -> tuple[str, Path]:
    """
    Cria um worktree isolado em <repo-parent>/.feedback-worktree-<id>/
    com branch nova `feedback/<id>-<slug>` baseada em origin/<base> (ou local <base>).

    Retorna (branch_name, worktree_path).
    """
    branch = branch_name_for(report_id, summary)
    wt = _worktree_dir(report_id)

    # Limpa worktree antigo se houver (re-execução)
    cleanup_worktree(report_id)

    base = base_branch()
    # tenta atualizar referência remota; ok falhar (offline/sem remote)
    _run_git(PROJECT_ROOT, "fetch", "origin", base, check=False, timeout=30)

    start_point = f"origin/{base}"
    try:
        _run_git(PROJECT_ROOT, "worktree", "add", "-B", branch, str(wt), start_point)
    except GitError:
        # fallback: branch local
        _run_git(PROJECT_ROOT, "worktree", "add", "-B", branch, str(wt), base)

    logger.info("git_executor: worktree criada em %s (branch=%s)", wt, branch)
    return branch, wt


# ─── Apply diff em worktree (não toca PROJECT_ROOT) ────────────────────────────

def apply_changes_to_worktree(worktree: Path, changes: list[dict]) -> list[dict]:
    """Aplica [{file, old, new}] dentro do worktree. Tenta exato → fuzzy."""
    from app.services.auto_fix_agent import _fuzzy_replace

    results: list[dict] = []
    for change in changes:
        rel = change.get("file", "")
        old = change.get("old", "")
        new = change.get("new", "")
        file_path = worktree / rel
        try:
            content = file_path.read_text(encoding="utf-8")
            if old and old in content:
                file_path.write_text(content.replace(old, new, 1), encoding="utf-8")
                results.append({"file": rel, "status": "applied"})
                continue
            patched = _fuzzy_replace(content, old, new) if old else None
            if patched is not None:
                file_path.write_text(patched, encoding="utf-8")
                results.append({"file": rel, "status": "applied", "method": "fuzzy"})
            else:
                results.append({"file": rel, "status": "not_found",
                                "error": "Trecho não encontrado (exact nem fuzzy)"})
        except FileNotFoundError:
            results.append({"file": rel, "status": "error", "error": "Arquivo não existe na branch base"})
        except Exception as e:
            results.append({"file": rel, "status": "error", "error": str(e)})
    return results


# ─── Commit + push ─────────────────────────────────────────────────────────────

def stage_and_commit(worktree: Path, changes: list[dict], message: str) -> str:
    """Stage arquivos alterados, commita com a mensagem dada, retorna SHA."""
    if not changes:
        raise GitError("Sem mudanças para commitar")
    for change in changes:
        _run_git(worktree, "add", change["file"], check=False)
    # Garante que algo foi staged
    status_out = _run_git(worktree, "status", "--porcelain", check=False)
    if not status_out:
        raise GitError("Nada foi staged — diff vazio ou arquivos não rastreados")
    _run_git(worktree, "commit", "-m", message, timeout=30)
    return _run_git(worktree, "rev-parse", "HEAD")


def push_worktree(worktree: Path, branch: str) -> bool:
    """Push da branch. Sem-op se GIT_PUSH_ENABLED não estiver true."""
    if not is_push_enabled():
        logger.warning("git_executor: GIT_PUSH_ENABLED=false — push pulado para %s", branch)
        return False
    _run_git(worktree, "push", "-u", "origin", branch, timeout=120)
    logger.info("git_executor: push concluído — %s", branch)
    return True
