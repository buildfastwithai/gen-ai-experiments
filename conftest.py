# conftest.py
"""
Shim google.colab.userdata to read from environment variables.
Installed before nbmake executes any notebook cell.
"""
import os
import sys
from types import ModuleType


def _make_colab_shim() -> None:
    userdata = ModuleType("google.colab.userdata")
    userdata.get = lambda key, default=None: os.environ.get(key, default)

    colab = ModuleType("google.colab")
    colab.userdata = userdata

    google = sys.modules.get("google") or ModuleType("google")
    google.colab = colab  # type: ignore[attr-defined]

    sys.modules["google"] = google
    sys.modules["google.colab"] = colab
    sys.modules["google.colab.userdata"] = userdata


_make_colab_shim()
