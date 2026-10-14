"""
Read side of the report runs: which runs exist, which is latest, and safe
access to a run's files. Runs are directories under <files_dir>/runs named
by their UTC generation time; <files_dir>/runs/latest holds the current id.
"""

import json
import re
from pathlib import Path

RUN_ID_PATTERN = re.compile(r'^\d{8}T\d{6}Z$')
FILE_NAME_PATTERN = re.compile(r'^[a-z0-9_]+\.png$')
REPORT_FILE = 'report.json'
LATEST_FILE = 'latest'


def runs_dir(files_dir):
    return Path(files_dir) / 'runs'


def is_safe_run_id(run_id):
    return bool(run_id) and RUN_ID_PATTERN.match(run_id) is not None


def is_safe_file_name(name):
    return bool(name) and FILE_NAME_PATTERN.match(name) is not None


def latest_run_id(files_dir):
    """The run id in runs/latest, or None when there is no run or it is gone."""
    pointer = runs_dir(files_dir) / LATEST_FILE
    try:
        run_id = pointer.read_text(encoding='utf-8').strip()
    except OSError:
        return None
    if not is_safe_run_id(run_id) or not (runs_dir(files_dir) / run_id / REPORT_FILE).is_file():
        return None
    return run_id


def read_report(files_dir, run_id):
    """The parsed report.json of a run, or None."""
    if not is_safe_run_id(run_id):
        return None
    path = runs_dir(files_dir) / run_id / REPORT_FILE
    try:
        with open(path, 'r', encoding='utf-8') as handle:
            return json.load(handle)
    except (OSError, json.JSONDecodeError):
        return None


def list_runs(files_dir):
    """Every complete run, newest first, with when it was generated and its files."""
    base = runs_dir(files_dir)
    if not base.is_dir():
        return []
    runs = []
    for child in sorted(base.iterdir(), reverse=True):
        if not child.is_dir() or not is_safe_run_id(child.name):
            continue
        report = read_report(files_dir, child.name)
        if report is None:
            continue
        runs.append({
            'runId': child.name,
            'generatedAt': report.get('generatedAt'),
            'eventCount': report.get('eventCount'),
            'files': report.get('files', []),
        })
    return runs
