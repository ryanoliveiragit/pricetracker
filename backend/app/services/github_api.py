"""
GitHub REST API executor — cria branches e commita mudanças sem git local.
Funciona em Vercel (sem git, filesystem read-only).

Vars de ambiente:
    GITHUB_TOKEN     Personal access token (scope: repo)
    GITHUB_REPO      "owner/repo"  ex: "ryanoliveiragit/pricetracker"
    GIT_BASE_BRANCH  branch base (default: main)
"""
from __future__ import annotations

import base64
import logging

import httpx

logger = logging.getLogger(__name__)

_GH = "https://api.github.com"


def _token() -> str:
    from app.config import settings
    t = (settings.GITHUB_TOKEN or "").strip()
    if not t:
        raise RuntimeError("GITHUB_TOKEN não configurado — adicione no Vercel dashboard ou backend/.env")
    return t


def _repo() -> str:
    from app.config import settings
    r = (settings.GITHUB_REPO or "").strip()
    if not r:
        raise RuntimeError("GITHUB_REPO não configurado — adicione no Vercel dashboard ou backend/.env (ex: owner/repo)")
    return r


def _headers() -> dict:
    return {
        "Authorization": f"Bearer {_token()}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }


def base_branch() -> str:
    from app.config import settings
    return settings.GIT_BASE_BRANCH or "main"


def branch_url(branch: str) -> str | None:
    try:
        return f"https://github.com/{_repo()}/tree/{branch}"
    except Exception:
        return None


def preview_url_for(branch: str) -> str | None:
    from app.config import settings
    pattern = (settings.VERCEL_PREVIEW_PATTERN or "").strip()
    if not pattern:
        return None
    return pattern.replace("{branch}", branch.replace("/", "-"))


def _fuzzy_replace(content: str, old: str, new: str, threshold: float = 0.82) -> str | None:
    from difflib import SequenceMatcher
    old_stripped = old.strip()
    lines = content.splitlines(keepends=True)
    n_old = max(1, len(old.splitlines()))
    best_ratio, best_i = 0.0, -1
    for i in range(max(1, len(lines) - n_old + 1)):
        window = "".join(lines[i : i + n_old]).strip()
        ratio = SequenceMatcher(None, old_stripped, window, autojunk=False).ratio()
        if ratio > best_ratio:
            best_ratio, best_i = ratio, i
    if best_ratio < threshold or best_i == -1:
        return None
    window_raw = "".join(lines[best_i : best_i + n_old])
    return content.replace(window_raw, new, 1)


async def create_branch_with_changes(
    report_id: int,
    changes: list[dict],
    commit_message: str,
) -> tuple[str, str]:
    """
    Cria branch feedback/<id> com as mudanças aplicadas via GitHub API.
    Busca o conteúdo atual de cada arquivo no GitHub, aplica old→new,
    cria um commit atômico e a branch ref.

    Retorna (branch_name, commit_sha).
    """
    repo = _repo()
    base = base_branch()
    branch = f"feedback/{report_id}"

    async with httpx.AsyncClient(
        base_url=f"{_GH}/repos/{repo}/",
        headers=_headers(),
        timeout=30.0,
    ) as gh:

        # 1. SHA do HEAD da branch base
        ref_resp = await gh.get(f"git/refs/heads/{base}")
        ref_resp.raise_for_status()
        base_sha = ref_resp.json()["object"]["sha"]

        # 2. SHA da tree base (para herdar arquivos não modificados)
        commit_resp = await gh.get(f"git/commits/{base_sha}")
        commit_resp.raise_for_status()
        base_tree_sha = commit_resp.json()["tree"]["sha"]

        # 3. Para cada arquivo: busca conteúdo do GitHub, aplica patch, cria blob
        tree_items: list[dict] = []
        apply_results: list[dict] = []

        for change in changes:
            rel = (change.get("file") or "").strip()
            old = change.get("old", "")
            new_patch = change.get("new", "")

            if not rel:
                continue

            try:
                file_resp = await gh.get(f"contents/{rel}", params={"ref": base})

                if file_resp.status_code == 404:
                    patched = new_patch
                    method = "new"
                else:
                    file_resp.raise_for_status()
                    # GitHub retorna content em base64 com quebras de linha
                    raw_b64 = file_resp.json()["content"].replace("\n", "")
                    current = base64.b64decode(raw_b64).decode("utf-8")

                    if old and old in current:
                        patched = current.replace(old, new_patch, 1)
                        method = "exact"
                    elif old:
                        patched = _fuzzy_replace(current, old, new_patch)
                        if patched is None:
                            apply_results.append({
                                "file": rel,
                                "status": "not_found",
                                "error": "Trecho não encontrado (exact nem fuzzy)",
                            })
                            continue
                        method = "fuzzy"
                    else:
                        patched = new_patch
                        method = "full"

                blob_resp = await gh.post("git/blobs", json={"content": patched, "encoding": "utf-8"})
                blob_resp.raise_for_status()
                tree_items.append({
                    "path": rel,
                    "mode": "100644",
                    "type": "blob",
                    "sha": blob_resp.json()["sha"],
                })
                apply_results.append({"file": rel, "status": "applied", "method": method})

            except httpx.HTTPStatusError as e:
                apply_results.append({
                    "file": rel,
                    "status": "error",
                    "error": f"HTTP {e.response.status_code}: {e.response.text[:120]}",
                })
            except Exception as e:
                apply_results.append({"file": rel, "status": "error", "error": str(e)})

        if not tree_items:
            failed = [r for r in apply_results if r["status"] != "applied"]
            raise RuntimeError(f"Nenhuma mudança pôde ser aplicada: {failed}")

        # 4. Nova tree (herda arquivos inalterados via base_tree)
        tree_resp = await gh.post("git/trees", json={
            "base_tree": base_tree_sha,
            "tree": tree_items,
        })
        tree_resp.raise_for_status()

        # 5. Novo commit
        new_commit_resp = await gh.post("git/commits", json={
            "message": commit_message,
            "tree": tree_resp.json()["sha"],
            "parents": [base_sha],
        })
        new_commit_resp.raise_for_status()
        commit_sha = new_commit_resp.json()["sha"]

        # 6. Cria a branch ref (ou força update se já existir)
        try:
            create_resp = await gh.post("git/refs", json={
                "ref": f"refs/heads/{branch}",
                "sha": commit_sha,
            })
            create_resp.raise_for_status()
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 422:
                patch_resp = await gh.patch(f"git/refs/heads/{branch}", json={
                    "sha": commit_sha,
                    "force": True,
                })
                patch_resp.raise_for_status()
            else:
                raise

        logger.info(
            "github_api: branch=%s sha=%s results=%s",
            branch, commit_sha[:8], apply_results,
        )
        return branch, commit_sha
