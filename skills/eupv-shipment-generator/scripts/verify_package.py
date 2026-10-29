#!/usr/bin/env python3
"""Verify files listed in references/source-manifest.sha256."""
from __future__ import annotations

import hashlib
from pathlib import Path


def main() -> int:
    root = Path(__file__).resolve().parent.parent
    manifest = root / "references" / "source-manifest.sha256"
    failures = []
    checked = 0
    for raw in manifest.read_text(encoding="utf-8").splitlines():
        if not raw.strip() or raw.lstrip().startswith("#"):
            continue
        expected, relative = raw.split("  ", 1)
        target = root / Path(relative)
        if not target.is_file():
            failures.append(f"missing: {relative}")
            continue
        actual = hashlib.sha256(target.read_bytes()).hexdigest().upper()
        checked += 1
        if actual != expected.upper():
            failures.append(f"hash mismatch: {relative}")
    if failures:
        raise SystemExit("\n".join(failures))
    print(f"Verified {checked} source files.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
