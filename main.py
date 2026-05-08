import sys
import os
import traceback

_backend = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend")
sys.path.insert(0, _backend)

_import_error = None
_import_tb = None

try:
    import importlib.util as _ilu
    _spec = _ilu.spec_from_file_location("_bm", os.path.join(_backend, "main.py"))
    _mod = _ilu.module_from_spec(_spec)
    sys.modules["_bm"] = _mod
    _spec.loader.exec_module(_mod)
    app = _mod.app
except Exception as _e:
    _import_error = str(_e)
    _import_tb = traceback.format_exc()

    from fastapi import FastAPI as _FA
    from fastapi.responses import JSONResponse as _JR
    app = _FA()

    @app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
    async def _catch_all(path: str = ""):
        return _JR({"import_error": _import_error, "traceback": _import_tb}, status_code=500)

    @app.get("/")
    async def _root():
        return _JR({"import_error": _import_error, "traceback": _import_tb}, status_code=500)
