"""Store TMDB credentials on the paired TV without putting them in a package."""
import argparse
import json
from pathlib import Path
import subprocess
from tv_control import ssh_args
import os
import re

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--token-file', type=Path, required=True, help='Private file containing a Read Access Token, or JSON with a token field')
parser.add_argument('--region', default='US')
parser.add_argument('--language', default='zh-CN')
args = parser.parse_args()
raw = args.token_file.expanduser().read_text().strip()
try:
    data = json.loads(raw)
except json.JSONDecodeError:
    data = raw
value = {'token': data.get('token', '') if isinstance(data, dict) else data, 'region': args.region, 'language': args.language}
if not isinstance(value['token'], str) or not value['token'] or len(value['token']) > 8192 or any(x.isspace() for x in value['token']):
    parser.error('The private file does not contain a valid token value')
if not re.fullmatch(r'[A-Z]{2}', args.region):
    parser.error('Region must be a two-letter country code')
if not re.fullmatch(r'[a-z]{2}(?:-[A-Z]{2})?', args.language):
    parser.error('Language must be a language code such as zh-CN')
code = r'''const fs=require('fs');let raw='';process.stdin.on('data',x=>raw+=x);process.stdin.on('end',()=>{
 const value=JSON.parse(raw),folder='/var/lib/lg-c5-home',file=folder+'/tmdb.json';let old={};
 try{old=JSON.parse(fs.readFileSync(file,'utf8'));}catch(e){}
 const next=Object.assign({},old,value);fs.mkdirSync(folder,{recursive:true});
 fs.writeFileSync(file+'.tmp',JSON.stringify(next),{mode:0o600});fs.chmodSync(file+'.tmp',0o600);fs.renameSync(file+'.tmp',file);
 process.stdout.write(JSON.stringify({configured:!!next.token,region:next.region,language:next.language}));
});'''
import shlex
result = subprocess.run(ssh_args() + ['root@' + os.environ['TV_HOST'], 'node -e ' + shlex.quote(code)], input=json.dumps(value).encode(), capture_output=True, timeout=15)
if result.returncode:
    raise SystemExit('Could not save TV configuration; the credential was not logged')
print(result.stdout.decode())
