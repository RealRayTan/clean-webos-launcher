"""Enable/disable the system-home mount; root and installed apps are retained."""
import sys
import subprocess
from tv_control import call, remote

SVC = '/media/developer/apps/usr/palm/services/com.gathin.tvhome.service'
SRC = '/media/developer/apps/usr/palm/applications/com.gathin.tvhome'
DST = '/usr/palm/applications/com.webos.app.home'
STATE = '/var/lib/lg-c5-home'

if sys.argv[1:] == ['off']:
    command = (
        f'mkdir -p {STATE}; touch {STATE}/disabled; '
        f'rm -f /var/lib/webosbrew/init.d/40-gathin-as-home /var/lib/webosbrew/init.d/60-lg-c5-home '
        f'/var/lib/webosbrew/init.d/41-gathin-screensaver '
        f'{STATE}/system-home {STATE}/native-enabled; '
        f'umount {DST} 2>/dev/null || true; '
        f'umount /usr/palm/applications/com.webos.app.screensaver 2>/dev/null || true; '
        f'umount {SRC}/appinfo.json 2>/dev/null || true; '
        f'if [ -f {STATE}/keybinds.before.json ]; then '
        f'cp {STATE}/keybinds.before.json /home/root/.config/lginputhook/keybinds.json; fi; '
        'systemctl restart sam || true; '
        'rm -f /tmp/homeback-remote-ipc/lease'
    )
    try:
        call('luna://com.gathin.tvhome.service/closeApp',
             {'id': 'com.webos.app.screensaver'}, timeout=3)
    except Exception:
        pass
    result = remote(command)
    if result.returncode:
        raise RuntimeError(result.stderr.decode())
    try:
        status = call('luna://com.gathin.tvhome.service/status', timeout=3)
        pid = int(status['pid'])
        result = remote(f'if [ "$(readlink /proc/{pid}/cwd)" = {SVC} ]; then kill {pid}; fi')
        if result.returncode:
            print('Desktop disabled; helper stop failed:', result.stderr.decode())
    except (RuntimeError, subprocess.TimeoutExpired, TimeoutError, KeyError, ValueError) as error:
        print('Desktop disabled; helper status unavailable:', error)
    try:
        print(call('luna://com.webos.applicationManager/launch', {'id': 'com.webos.app.home'}))
    except (RuntimeError, subprocess.TimeoutExpired, TimeoutError) as error:
        print('Desktop disabled; stock Home launch unavailable:', error)
    print('System home disabled. Root and all installed apps are retained.')
elif sys.argv[1:] == ['on']:
    try:
        call('luna://com.gathin.tvhome.service/closeApp',
             {'id': 'com.webos.app.screensaver'}, timeout=3)
    except Exception:
        pass
    command = (
        f'rm -f {STATE}/disabled; '
        'ln -sf ' + SVC + '/as-home.sh /var/lib/webosbrew/init.d/40-gathin-as-home; '
        'ln -sf ' + SVC + '/screensaver-as-system.sh /var/lib/webosbrew/init.d/41-gathin-screensaver; '
        f'sh {SVC}/as-home.sh; '
        f'sh {SVC}/screensaver-as-system.sh'
    )
    result = remote(command)
    if result.returncode:
        raise RuntimeError(result.stderr.decode())
    print('System home enabled.')
else:
    raise SystemExit('Usage: python3 desktop_mode.py off|on')
