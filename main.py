import sys
import os
import traceback

_backend = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend")
sys.path.insert(0, _backend)

_errors = []

# Layer 1: import real backend app via importlib (avoids name collision with this file)
try:
    import importlib.util as _ilu
    _spec = _ilu.spec_from_file_location("_bm", os.path.join(_backend, "main.py"))
    _mod = _ilu.module_from_spec(_spec)
    sys.modules["_bm"] = _mod
    _spec.loader.exec_module(_mod)
    app = _mod.app
except Exception as _e:
    _errors.append({"stage": "backend_import", "error": str(_e), "tb": traceback.format_exc()})

    # Layer 2: minimal FastAPI app that returns the error as JSON
    try:
        from fastapi import FastAPI
        from fastapi.responses import JSONResponse

        app = FastAPI()
        _snap = list(_errors)

        @app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
        async def _err_handler(path: str = ""):
            return JSONResponse({"startup_errors": _snap}, status_code=500)

    except Exception as _e2:
        _errors.append({"stage": "fastapi_fallback", "error": str(_e2)})

        # Layer 3: raw ASGI — zero dependencies, always works
        import json as _json
        _body = _json.dumps({"startup_errors": _errors}).encode()

        async def app(scope, receive, send):  # type: ignore[misc]
            if scope["type"] == "http":
                await send({
                    "type": "http.response.start",
                    "status": 500,
                    "headers": [(b"content-type", b"application/json")],
                })
                await send({"type": "http.response.body", "body": _body})
            elif scope["type"] == "lifespan":
                await receive()
                await send({"type": "lifespan.startup.complete"})
                await receive()
                await send({"type": "lifespan.shutdown.complete"})
