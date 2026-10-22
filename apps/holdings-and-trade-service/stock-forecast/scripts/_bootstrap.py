"""Lets the numbered scripts import the package without installing it."""
import sys
from pathlib import Path

# Let numbered scripts run directly without an editable package install.
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
