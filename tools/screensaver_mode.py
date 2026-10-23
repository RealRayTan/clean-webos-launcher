"""Enable/disable the system screen-saver replacement; stock app is not modified."""
import sys
from tv_control import call, remote

SVC = '/media/developer/apps/usr/palm/services/com.gathin.tvhome.service'
DST = '/usr/palm/applications/com.webos.app.screensaver'
STATE = '/var/lib/lg-c5-home'
INIT = '/var/lib/webosbrew/init.d/41-gathin-screensaver'


def run(command, timeout=20):
    result = remote(command, timeout=timeout)
    if result.returncode:
        raise RuntimeError(result.stderr.decode())
    return result


if sys.argv[1:] == ['off']:
    try:
        call('luna://com.gathin.tvhome.service/closeApp',
             {'id': 'com.webos.app.screensaver'}, timeout=3)
    except Exception:
        pass
    run(
        f'rm -f {INIT}; '
        f'umount -l {DST} 2>/dev/null || true; '
        'systemctl restart sam || true',
        timeout=45
    )
    print('System screen saver restored.')
elif sys.argv[1:] == ['on']:
    try:
        call('luna://com.gathin.tvhome.service/closeApp',
             {'id': 'com.webos.app.screensaver'}, timeout=3)
    except Exception:
        pass
    run(
        f'mkdir -p {STATE}; '
        f'ln -sf {SVC}/screensaver-as-system.sh {INIT}; '
        f'sh {SVC}/screensaver-as-system.sh; '
        'systemctl restart sam || true',
        timeout=45
    )
    print('System screen saver replaced.')
else:
    raise SystemExit('Usage: python3 screensaver_mode.py off|on')
