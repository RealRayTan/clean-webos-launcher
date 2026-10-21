"""Enable/disable only the custom desktop; does not remove root or installed apps."""
import sys
import subprocess
from tv_control import call, remote

if sys.argv[1:] == ['off']:
    result = remote('mkdir -p /var/lib/lg-c5-home; touch /var/lib/lg-c5-home/disabled; '
        'rm -f /var/lib/webosbrew/init.d/60-lg-c5-home /tmp/homeback-remote-ipc/lease')
    if result.returncode:
        raise RuntimeError(result.stderr.decode())
    try:
        status = call('luna://com.gathin.tvhome.service/status', timeout=3)
        pid = int(status['pid'])
        result = remote(f'if [ "$(readlink /proc/{pid}/cwd)" = /media/developer/apps/usr/palm/services/com.gathin.tvhome.service ]; then kill {pid}; fi')
        if result.returncode:
            print('Desktop disabled; helper stop failed:', result.stderr.decode())
    except (RuntimeError, subprocess.TimeoutExpired, TimeoutError, KeyError, ValueError) as error:
        print('Desktop disabled; helper status unavailable:', error)
    try:
        print(call('luna://com.webos.applicationManager/launch', {'id':'com.webos.app.home'}))
    except (RuntimeError, subprocess.TimeoutExpired, TimeoutError) as error:
        print('Desktop disabled; native Home launch unavailable:', error)
    print('Custom desktop disabled. Root and all installed apps are retained.')
elif sys.argv[1:] == ['on']:
    command = ('rm -f /var/lib/lg-c5-home/disabled; '
        'ln -sf /media/developer/apps/usr/palm/services/com.gathin.tvhome.service/autostart.sh /var/lib/webosbrew/init.d/60-lg-c5-home; '
        'sh /var/lib/webosbrew/init.d/60-lg-c5-home')
    result = remote(command)
    if result.returncode:
        raise RuntimeError(result.stderr.decode())
    print('Custom desktop enabled.')
else:
    raise SystemExit('Usage: python3 desktop_mode.py off|on')
