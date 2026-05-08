import sys
import os
import importlib.util

_backend = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend")
sys.path.insert(0, _backend)

_spec = importlib.util.spec_from_file_location(
    "_backend_main",
    os.path.join(_backend, "main.py"),
)
_mod = importlib.util.module_from_spec(_spec)
sys.modules["_backend_main"] = _mod
_spec.loader.exec_module(_mod)
app = _mod.app
