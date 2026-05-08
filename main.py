import sys
import os
import importlib.util

_root = os.path.dirname(os.path.abspath(__file__))
_backend = os.path.join(_root, "backend")

sys.path.insert(0, _backend)

spec = importlib.util.spec_from_file_location(
    "backend_main",
    os.path.join(_backend, "main.py"),
)
_mod = importlib.util.module_from_spec(spec)
sys.modules["backend_main"] = _mod
spec.loader.exec_module(_mod)

app = _mod.app
