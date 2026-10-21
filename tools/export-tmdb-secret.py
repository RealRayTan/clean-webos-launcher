"""Validate repository TMDB credentials and encrypt the TV config to an operator certificate."""
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import urllib.error
import urllib.request


def check(token=None, key=None):
    url = 'https://api.themoviedb.org/3/configuration'
    headers = {'Accept': 'application/json'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    elif key:
        url += '?api_key=' + key
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=15) as response:
            data = json.load(response)
        return isinstance(data.get('images'), dict)
    except Exception:
        return False


def main():
    token = os.environ.get('TMDB_ACCESS_TOKEN', '').strip()
    api_key = os.environ.get('TMDB_API_SECRET', '').strip()
    certificate = os.environ.get('BOOTSTRAP_CERTIFICATE', '')
    token_valid = bool(token) and not any(x.isspace() for x in token) and check(token=token)
    print('TMDB_ACCESS_TOKEN: ' + ('valid' if token_valid else 'invalid or missing'))
    if re.fullmatch(r'[A-Fa-f0-9]{32}', api_key):
        print('TMDB_API_SECRET as v3 API key: ' + ('valid' if check(key=api_key) else 'invalid'))
    else:
        print('TMDB_API_SECRET: not checked; not a v3 API key format')
    if not token_valid:
        raise SystemExit('A valid API Read Access Token is required; no credentials exported')
    old_umask = os.umask(0o077)
    try:
        with tempfile.TemporaryDirectory() as folder:
            folder = Path(folder)
            cert = folder / 'operator.pem'
            cert.write_text(certificate)
            verified = subprocess.run(['openssl', 'x509', '-in', str(cert), '-noout', '-checkend', '0'], capture_output=True)
            if verified.returncode:
                raise SystemExit('The operator certificate is invalid or expired')
            payload = folder / 'config.json'
            payload.write_text(json.dumps({'token': token, 'region': 'US', 'language': 'zh-CN', 'bindings': {}}))
            output = Path(os.environ['RUNNER_TEMP']) / 'tmdb-config.cms'
            encrypted = subprocess.run(['openssl', 'cms', '-encrypt', '-aes-256-cbc', '-binary', '-outform', 'DER', '-in', str(payload), '-out', str(output), str(cert)], capture_output=True)
            if encrypted.returncode:
                raise SystemExit('Credential encryption failed')
            print('Encrypted configuration ready; decryption requires the local private key')
    finally:
        os.umask(old_umask)


if __name__ == '__main__':
    main()
