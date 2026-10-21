"""Install the prepared release on an already rooted TV. Does not obtain root."""
import json
import os
import shlex
import subprocess
from tv_control import ROOT, call, remote, ssh_args

package = ROOT / 'build/com.gathin.tvhome_1.0.7_all.ipk'
if not package.is_file():
    raise SystemExit('Run scripts/build.sh first')

def checked(command, timeout=20):
    result = remote(command, timeout=timeout)
    if result.returncode:
        raise RuntimeError(result.stderr.decode(errors='replace'))
    return result

try:
    status = call('luna://com.gathin.tvhome.service/status', timeout=3)
except (RuntimeError, subprocess.TimeoutExpired):
    status = None
if status:
    pid = int(status['pid'])
    checked(f'if [ "$(readlink /proc/{pid}/cwd)" = /media/developer/apps/usr/palm/services/com.gathin.tvhome.service ]; then kill {pid}; fi')
scp = ssh_args()
scp[0] = 'scp'
subprocess.run(scp[:1] + ['-O'] + scp[1:] + [str(package), 'root@' + os.environ['TV_HOST'] + ':/tmp/lg-webos-desktop.ipk'], check=True)
payload = {'id': 'com.ares.defaultName', 'ipkUrl': '/tmp/lg-webos-desktop.ipk', 'subscribe': True}
command = 'luna-send -i -f luna://com.webos.appInstallService/dev/install ' + shlex.quote(json.dumps(payload))
process = subprocess.Popen(ssh_args() + ['-tt', 'root@' + os.environ['TV_HOST'], command], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
try:
    output, error = process.communicate(timeout=30)
except subprocess.TimeoutExpired:
    process.terminate()
    output, error = process.communicate(timeout=5)
if b'"state": "installed"' not in output:
    raise RuntimeError((output + error).decode(errors='replace'))
checked('/media/developer/apps/usr/palm/services/org.webosbrew.hbchannel.service/elevate-service com.gathin.tvhome.service')
configure = '''var fs=require('fs');
var base='/home/root/.config/lginputhook',file=base+'/keybinds.json';
fs.mkdirSync(base,{recursive:true});
var config={};
if(fs.existsSync(file)){
  config=JSON.parse(fs.readFileSync(file,'utf8'));
  if(!fs.existsSync('/var/lib/lg-c5-home/keybinds.before.json'))fs.copyFileSync(file,'/var/lib/lg-c5-home/keybinds.before.json');
}
config['773']={action:'timed_ignore'};
fs.writeFileSync(file,JSON.stringify(config));'''
checked('mkdir -p /var/lib/lg-c5-home; node -e ' + shlex.quote(configure))
call('luna://com.webos.settingsservice/setSystemSettings', {'category': 'general', 'settings': {'homeAutoLaunch': 'off'}})
checked('mkdir -p /var/lib/webosbrew/init.d; '
        'rm -f /var/lib/lg-c5-home/disabled; '
        'touch /var/lib/lg-c5-home/native-enabled; '
        'ln -sf /media/developer/apps/usr/palm/services/com.gathin.tvhome.service/autostart.sh /var/lib/webosbrew/init.d/60-lg-c5-home; '
        'sh /var/lib/webosbrew/init.d/60-lg-c5-home')
print('Installed. Check Home behavior and the shutdown-screen setting once on your TV.')
