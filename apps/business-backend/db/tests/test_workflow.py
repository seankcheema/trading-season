import importlib.util
import subprocess
import sys
import json
import tempfile
from unittest.mock import patch
import unittest
from datetime import date
from pathlib import Path

SCRIPTS=Path(__file__).parents[1]/"scripts"
sys.path.insert(0,str(SCRIPTS))
from lib.common import MARKET_TIMEZONE, session_open, weekdays
from lib.generation import generate
from lib.validation import load_manifest

class WorkflowTests(unittest.TestCase):
    def test_weekdays_include_holidays_and_exclude_weekends(self):
        self.assertEqual(weekdays(date(2026,7,3),date(2026,7,6)),[date(2026,7,3),date(2026,7,6)])
    def test_dst_offsets_change(self):
        winter=session_open(date(2026,3,6)); summer=session_open(date(2026,3,9))
        self.assertEqual(summer-winter,71*3600)
    def test_initialize_requires_disposable_flag(self):
        result=subprocess.run([sys.executable,str(SCRIPTS/"0001-initialize-database.py"),"--database-url","postgresql://unused"],capture_output=True,text=True)
        self.assertNotEqual(result.returncode,0); self.assertIn("--disposable-database is required",result.stderr)
    def test_candle_only_archive_requires_regeneration(self):
        with tempfile.TemporaryDirectory() as directory:
            Path(directory,"manifest.json").write_text(json.dumps({"schema_version":1,"files":[]}),encoding="utf-8")
            with self.assertRaisesRegex(ValueError,"Candle-only"):
                load_manifest(Path(directory))
    def test_failed_regeneration_preserves_archive_and_corruption_is_detected(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)/"archive"
            original=generate(root,start_date=date(2026,1,5),end_date=date(2026,1,5))
            with patch("lib.generation.validate_archive",side_effect=ValueError("injected validation failure")):
                with self.assertRaisesRegex(ValueError,"injected"):
                    generate(root,start_date=date(2026,1,5),end_date=date(2026,1,5),regenerate=True)
            self.assertEqual(load_manifest(root)["fingerprint"],original["fingerprint"])
            tick=root/original["tick_files"][0]["name"]
            with tick.open("ab") as stream: stream.write(b"corrupt")
            with self.assertRaisesRegex(ValueError,"corrupt"):
                load_manifest(root)

if __name__=="__main__": unittest.main()
