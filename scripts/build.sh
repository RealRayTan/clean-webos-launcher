#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
for file in service/native/ezinject service/native/libinputhookpp.so; do
  [ -f "$file" ] || { echo 'Prepare native dependencies first; see docs/native.md' >&2; exit 1; }
done
python3 - <<'PY'
import hashlib
from pathlib import Path
base=Path('service/native')
for line in (base/'SHA256SUMS').read_text().splitlines():
    expected,name=line.split()
    if hashlib.sha256((base/name.lstrip('*')).read_bytes()).hexdigest()!=expected:
        raise SystemExit('Native dependency hash mismatch: '+name)
PY
[ -f app/apps.js ] || cp app/apps.example.js app/apps.js
mkdir -p build
if command -v ares-package >/dev/null; then
  ares-package --no-minify app service -o build
else
  echo 'Install @webos-tools/cli to obtain ares-package.' >&2
  exit 1
fi
