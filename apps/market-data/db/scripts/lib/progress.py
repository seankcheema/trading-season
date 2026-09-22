from __future__ import annotations

import sys
import time
from dataclasses import dataclass


@dataclass
class Progress:
    """Render a compact terminal progress bar with elapsed time."""

    enabled: bool = True
    width: int = 28

    def __post_init__(self) -> None:
        self.started = time.monotonic()
        self._last_length = 0

    def update(self, current: int, total: int, label: str) -> None:
        if not self.enabled:
            return
        ratio = min(1.0, current / total) if total else 1.0
        filled = int(self.width * ratio)
        elapsed = time.monotonic() - self.started
        line = f"[{('=' * filled).ljust(self.width)}] {ratio:6.1%}  {label}  {elapsed:,.1f}s"
        padding = " " * max(0, self._last_length - len(line))
        print(f"\r{line}{padding}", end="", file=sys.stderr, flush=True)
        self._last_length = len(line)
        if current >= total:
            print(file=sys.stderr)
            self._last_length = 0

