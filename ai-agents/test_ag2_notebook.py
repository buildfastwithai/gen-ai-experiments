"""Structural validation for AG2 notebook — no API keys required."""
import json
from pathlib import Path

NOTEBOOK = Path(__file__).parent / "AG2_Building_Multi_Agent_AI_Systems.ipynb"

def test_notebook_is_valid_json():
    nb = json.loads(NOTEBOOK.read_text())
    assert nb["nbformat"] >= 4

def test_notebook_has_code_cells():
    nb = json.loads(NOTEBOOK.read_text())
    code_cells = [c for c in nb["cells"] if c["cell_type"] == "code"]
    assert len(code_cells) >= 3, "Expected at least 3 code cells"

def test_colab_shim_works():
    """Verify the conftest.py colab shim injects google.colab into sys.modules."""
    import sys
    assert "google.colab" in sys.modules, "Colab shim not active"
    from google.colab import userdata
    import os
    os.environ["TEST_SHIM_KEY"] = "hello"
    assert userdata.get("TEST_SHIM_KEY") == "hello"
