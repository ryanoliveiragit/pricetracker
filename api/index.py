import sys
import os
import traceback

_backend = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if _backend not in sys.path:
    sys.path.insert(0, _backend)

_errors = []

try:
    from main import app  # imports backend/main.py
except Exception as _e:
    _errors.append({"stage": "backend_import", "error": str(_e), "tb": traceback.format_exc()})

    try:
        from fastapi import FastAPI
        from fastapi.responses import JSONResponse as _JR

        app = FastAPI()
        _err_snapshot = list(_errors)

        @app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
        async def _err_handler(path: str = ""):
            return _JR({"startup_errors": _err_snapshot}, status_code=500)

    except Exception as _e2:
        _errors.append({"stage": "fastapi_fallback", "error": str(_e2)})

        import json as _json
        _body = _json.dumps({"startup_errors": _errors}).encode()

        async def app(scope, receive, send):  # type: ignore[misc]
            if scope["type"] == "http":
                await send({"type": "http.response.start", "status": 500,
                           "headers": [(b"content-type", b"application/json")]})
                await send({"type": "http.response.body", "body": _body})
            elif scope["type"] == "lifespan":
                await receive()
                await send({"type": "lifespan.startup.complete"})
                await receive()
                await send({"type": "lifespan.shutdown.complete"})
