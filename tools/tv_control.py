"""Root SSH and Luna controls. Connection details come from the environment."""
from pathlib import Path
import json
import os
import re
import shlex
import subprocess

ROOT = Path(__file__).resolve().parents[1]

def ssh_args():
    host = os.environ.get('TV_HOST', '')
    key = os.environ.get('TV_SSH_KEY', '')
    if not re.fullmatch(r'[A-Za-z0-9_.:-]+', host):
        raise ValueError('Set TV_HOST to your TV address')
    if not key or not Path(key).expanduser().is_file():
        raise ValueError('Set TV_SSH_KEY to your root SSH private key')
    return ['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=8', '-o', 'IdentitiesOnly=yes', '-i', str(Path(key).expanduser())]

def remote(command, tty=False, timeout=20):
    args = ssh_args()
    if tty:
        args.append('-tt')
    args += ['root@' + os.environ['TV_HOST'], command]
    return subprocess.run(args, capture_output=True, timeout=timeout)

def call(uri, payload=None, timeout=15):
    command = 'luna-send -n 1 -w ' + str(timeout * 1000) + ' -f ' + shlex.quote(uri) + ' ' + shlex.quote(json.dumps(payload or {}, ensure_ascii=False))
    result = remote(command, tty=True, timeout=timeout + 5)
    output = result.stdout.decode('utf-8', errors='replace').replace('\r\n', '\n')
    if result.returncode or not output.strip():
        raise RuntimeError(output + result.stderr.decode(errors='replace'))
    response = json.loads(output)
    if response.get('returnValue') is False:
        raise RuntimeError(json.dumps(response, ensure_ascii=False))
    return response
