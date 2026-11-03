#!/usr/bin/env python3
"""Resolve civil time using the bundled, hashed TZif snapshot (stdlib only).

PEP 495: validate both folds by UTC round-trip; deduplicate UTC instants,
never local datetime equality. No operating-system timezone fallback.
"""
import datetime as dt
import hashlib
import io
import json
from pathlib import Path
import sys
from zoneinfo import ZoneInfo


def resolve(solar, hour, minute, timezone):
    root = Path(__file__).resolve().parent.parent / "data" / "tzdb"
    manifest = json.loads((root / "manifest.json").read_text())
    expected = manifest["zones"].get(timezone)
    if expected is None:
        raise ValueError("unsupported_timezone")
    data = (root / timezone).read_bytes()
    if hashlib.sha256(data).hexdigest() != expected:
        raise ValueError("timezone_data_integrity_error")
    zone = ZoneInfo.from_file(io.BytesIO(data), key=timezone)
    wall = dt.datetime.fromisoformat(solar).replace(hour=int(hour), minute=int(minute))
    candidates = {}
    for fold in (0, 1):
        local = wall.replace(tzinfo=zone, fold=fold)
        utc = local.astimezone(dt.timezone.utc)
        if utc.astimezone(zone).replace(tzinfo=None) == wall:
            candidates[utc.isoformat()] = local
    metadata = {"tzdbVersion": manifest["version"], "tzifSha256": expected}
    if len(candidates) != 1:
        return {"error": "ambiguous_local_time" if candidates else "nonexistent_local_time",
                "candidates": sorted(candidates), **metadata}
    utc, local = next(iter(candidates.items()))
    offset = local.utcoffset().total_seconds()
    dst = local.dst().total_seconds()
    return {"utcInstant": utc, "offsetSeconds": offset, "dstSeconds": dst,
            "standardOffsetSeconds": offset - dst, **metadata}


if __name__ == "__main__":
    try:
        result = resolve(*sys.argv[1:])
    except Exception as error:
        result = {"error": "timezone_resolution_failed", "message": str(error)}
    print(json.dumps(result))
    sys.exit(1 if "error" in result else 0)
