"""Copy the externally built ARM32 candidate only if its pinned hashes match."""
from pathlib import Path
import hashlib
import shutil
import sys

root = Path(__file__).resolve().parents[1]
if len(sys.argv) != 2:
    raise SystemExit('Usage: python3 scripts/prepare_native.py /path/to/native-artifact')
source = Path(sys.argv[1]).resolve()
target = root / 'service/native'
for line in (target / 'SHA256SUMS').read_text().splitlines():
    digest, filename = line.split()
    filename = filename.lstrip('*')
    artifact = source / filename
    if hashlib.sha256(artifact.read_bytes()).hexdigest() != digest:
        raise SystemExit('Hash mismatch: ' + filename)
for filename in ('ezinject', 'libinputhookpp.so'):
    shutil.copy2(source / filename, target / filename)
    (target / filename).chmod(0o755)
print('Prepared pinned native dependencies; nothing was installed on a TV.')
