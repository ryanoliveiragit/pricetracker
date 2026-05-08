import sys
import os
import traceback

_root = os.path.dirname(os.path.abspath(__file__))
_backend = os.path.join(_root, "backend")
sys.path.insert(0, _backend)

try:
    import importlib.util
    spec = importlib.util.spec_from_file_location(
        "backend_main",
        os.path.join(_backend, "main.py"),
    )
    _mod = importlib.util.module_from_spec(spec)
    sys.modules["backend_main"] = _mod
    spec.loader.exec_module(_mod)
    app = _mod.app
except Exception as _e:
    from fastapi import FastAPI
    from fastapi.responses import JSONResponse

    app = FastAPI()
    _tb = traceback.format_exc()

    @app.get("/{path:path}")
    async def _error(path: str = ""):
        return JSONResponse({"error": str(_e), "traceback": _tb}, status_code=500)
