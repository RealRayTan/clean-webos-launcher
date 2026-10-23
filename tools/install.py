"""Install the prepared release on an already rooted TV. Does not obtain root."""
import json
import os
import shlex
import subprocess
import time
from tv_control import ROOT, call, remote, ssh_args

version = json.loads((ROOT / 'app/appinfo.json').read_text())['version']
package = ROOT / ('build/com.gathin.tvhome_' + version + '_all.ipk')
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

# The regular app still has the user's localStorage. Launch it once so the new
# shared-state service receives that state before the system-home copy loads.
try:
    call('luna://com.webos.applicationManager/launch', {'id': 'com.gathin.tvhome'}, timeout=8)
    time.sleep(2)
except (RuntimeError, subprocess.TimeoutExpired, TimeoutError) as error:
    print('State sync launch unavailable:', error)

# Mount the app as LG's Home and keep the normal app entry hidden. The script
# restores the native Home key path, disables the old helper, and restarts sam.
checked('mkdir -p /var/lib/webosbrew/init.d; '
        'rm -f /var/lib/lg-c5-home/disabled; '
        'ln -sf /media/developer/apps/usr/palm/services/com.gathin.tvhome.service/as-home.sh /var/lib/webosbrew/init.d/40-gathin-as-home; '
        'sh /media/developer/apps/usr/palm/services/com.gathin.tvhome.service/as-home.sh')
print('Installed as system Home. Check Home, Back from an app, and the shutdown-screen setting once on your TV.')
