import importlib.util
import asyncio
import subprocess
import sys
import json
import tempfile
from unittest.mock import patch
import unittest
from datetime import date
from pathlib import Path
import asyncpg

SCRIPTS=Path(__file__).parents[1]/"scripts"
sys.path.insert(0,str(SCRIPTS))
from lib.common import MARKET_TIMEZONE, SESSION_SECONDS, session_open, weekdays
from lib.generation import generate
from lib.importing import _available_disk, estimate_disk, group_archive_months, normalize_tick_storage, require_disk_space
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
    def test_archive_files_are_grouped_by_calendar_month(self):
        def item(day): return {"day":day,"name":day,"bytes":1,"sha256":day}
        manifest={"symbols":[{"symbol":"A"}],"tick_files":[item("2026-01-30"),item("2026-02-02")],
                  "candle_files":[item("2026-01-30"),item("2026-02-02")]}
        months=group_archive_months(manifest)
        self.assertEqual([month.key for month in months],["2026-01","2026-02"])
        self.assertEqual(months[0].tick_count,SESSION_SECONDS)
    def test_dst_days_remain_in_the_same_month_checkpoint(self):
        def item(day): return {"day":day,"name":day,"bytes":1,"sha256":day}
        manifest={"symbols":[{"symbol":"A"}],"tick_files":[item("2026-03-06"),item("2026-03-09")],
                  "candle_files":[item("2026-03-06"),item("2026-03-09")]}
        self.assertEqual([month.key for month in group_archive_months(manifest)],["2026-03"])
    def test_archive_grouping_handles_a_year_boundary(self):
        def item(day): return {"day":day,"name":day,"bytes":1,"sha256":day}
        manifest={"symbols":[{"symbol":"A"}],"tick_files":[item("2026-12-31"),item("2027-01-01")],
                  "candle_files":[item("2026-12-31"),item("2027-01-01")]}
        self.assertEqual([month.key for month in group_archive_months(manifest)],["2026-12","2027-01"])
    def test_disk_estimate_rejects_insufficient_capacity(self):
        def item(day): return {"day":day,"name":day,"bytes":1,"sha256":day}
        manifest={"symbols":[{"symbol":"A"}],"tick_files":[item("2026-01-05")],"candle_files":[item("2026-01-05")]}
        estimate=estimate_disk(group_archive_months(manifest),1,"test")
        with self.assertRaisesRegex(ValueError,"Insufficient PostgreSQL disk space"):
            require_disk_space(estimate)
        self.assertGreater(estimate.persistent_bytes,0)
    def test_parquet_storage_is_smaller_than_postgres_storage(self):
        def item(day): return {"day":day,"name":day,"bytes":1,"sha256":day}
        manifest={"symbols":[{"symbol":"A"}],"tick_files":[item("2026-01-05")],"candle_files":[item("2026-01-05")]}
        months=group_archive_months(manifest)
        parquet=estimate_disk(months,10*1024**3,"test","parquet")
        postgres=estimate_disk(months,10*1024**3,"test","postgres")
        self.assertLess(parquet.required_bytes,postgres.required_bytes)
    def test_tick_storage_values_are_validated(self):
        self.assertEqual(normalize_tick_storage("PARQUET"),"parquet")
        self.assertEqual(normalize_tick_storage("postgres"),"postgres")
        with self.assertRaisesRegex(ValueError,"parquet.*postgres"):
            normalize_tick_storage("database")
    def test_disk_check_fails_closed_when_server_path_is_inaccessible(self):
        class Connection:
            async def fetchval(self,query): return "Z:/missing-postgresql-data"
        with self.assertRaisesRegex(ValueError,"--available-disk-gb"):
            asyncio.run(_available_disk(Connection(),None,0,None))
    def test_operator_disk_override_is_accepted(self):
        class Connection:
            async def fetchval(self,query): return 100
        available,source,_=asyncio.run(_available_disk(Connection(),10,100,None))
        self.assertEqual(available,10*1024**3)
        self.assertIn("operator-provided",source)
    def test_disk_check_explains_missing_postgresql_privilege(self):
        class Connection:
            async def fetchval(self,query):
                raise asyncpg.InsufficientPrivilegeError("permission denied")
        with self.assertRaisesRegex(ValueError,"--available-disk-gb"):
            asyncio.run(_available_disk(Connection(),None,0,None))

if __name__=="__main__": unittest.main()
