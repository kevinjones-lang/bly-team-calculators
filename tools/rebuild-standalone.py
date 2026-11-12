#!/usr/bin/env python3
"""Re-encode business-plan sources into business-plan-standalone.html."""

import base64
import gzip
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STANDALONE = ROOT / "business-plan-standalone.html"
SOURCES = {
    "9f8f3443-8100-4d81-9857-c0b2b6cf50e0": ROOT / "business-plan" / "app-v2.jsx",
    "a56e4a87-886a-4ee2-ba2f-01922be322ae": ROOT / "business-plan" / "plan.js",
    "07a22ec7-b034-437d-bf15-2d631c0c1b06": ROOT / "business-plan" / "engine.js",
}


def gzip_b64(data: bytes) -> str:
    blob = bytearray(gzip.compress(data, compresslevel=5, mtime=0))
    blob[9] = 0x13
    return base64.b64encode(blob).decode("ascii")


def replace_data(text: str, uuid: str, data: str) -> str:
    marker = f'"{uuid}":{{"mime":"application/javascript","compressed":true,"data":"'
    start = text.find(marker)
    if start < 0:
        raise SystemExit(f"manifest entry not found: {uuid}")
    start += len(marker)
    end = text.find('"', start)
    if end < 0:
        raise SystemExit(f"manifest data not closed: {uuid}")
    return text[:start] + data + text[end:]


def decoded_sources(text: str) -> dict:
    start = text.index('<script type="__bundler/manifest">')
    start = text.index(">", start) + 1
    end = text.index("</script>", start)
    manifest = json.loads(text[start:end])
    out = {}
    for uuid in SOURCES:
        entry = manifest[uuid]
        raw = base64.b64decode(entry["data"])
        out[uuid] = gzip.decompress(raw) if entry["compressed"] else raw
    return out


def main() -> None:
    text = STANDALONE.read_text()
    for uuid, path in SOURCES.items():
        text = replace_data(text, uuid, gzip_b64(path.read_bytes()))
    STANDALONE.write_text(text)
    got = decoded_sources(STANDALONE.read_text())
    for uuid, path in SOURCES.items():
        want = path.read_bytes()
        if got[uuid] != want:
            raise SystemExit(f"decoded {path.name} does not match the repo file")
    print("rebuilt business-plan-standalone.html")


if __name__ == "__main__":
    sys.exit(main())
