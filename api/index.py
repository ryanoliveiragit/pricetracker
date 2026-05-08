import sys
import os
import traceback

# Resolve backend path — try multiple candidates since __file__ location varies in Lambda
_file_dir = os.path.dirname(os.path.abspath(__file__))
_backend = None
for _candidate in [
    os.path.normpath(os.path.join(_file_dir, "..", "backend")),  # api/index.py → ../backend
    os.path.normpath(os.path.join(_file_dir, "backend")),         # if __file__ at root
    os.path.normpath(os.path.join(os.getcwd(), "backend")),       # via working directory
]:
    if os.path.isdir(_candidate):
        _backend = _candidate
        break

if _backend is None:
    _backend = os.path.normpath(os.path.join(_file_dir, "..", "backend"))

if _backend not in sys.path:
    sys.path.insert(0, _backend)

_errors = []
_debug = {"__file__": __file__, "backend_path": _backend, "cwd": os.getcwd()}

# Layer 1: import the real backend FastAPI app
try:
    from main import app  # resolves to backend/main.py via sys.path
except Exception as _e:
    _errors.append({"stage": "backend_import", "error": str(_e), "tb": traceback.format_exc()})

    # Layer 2: minimal FastAPI fallback that exposes the error as JSON
    try:
        from fastapi import FastAPI
        from fastapi.responses import JSONResponse as _JR

        app = FastAPI()
        _snap = {"errors": list(_errors), "debug": _debug}

        @app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
        async def _err_handler(path: str = ""):
            return _JR(_snap, status_code=500)

    except Exception as _e2:
        _errors.append({"stage": "fastapi_fallback", "error": str(_e2)})

        # Layer 3: raw ASGI — zero dependencies, always works
        import json as _json
        _body = _json.dumps({"errors": _errors, "debug": _debug}).encode()

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
