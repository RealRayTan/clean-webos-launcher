#!/bin/sh
# Replace LG's screen-saver app with the launcher's pure-black clock.
# The bind mount hides the stock Flutter app without changing it on disk, so
# `screensaver_mode.py off` restores the original screen saver immediately.
set -eu
SVCDIR=/media/developer/apps/usr/palm/services/com.gathin.tvhome.service
SRC="$SVCDIR/screensaver-app"
STATE=/var/lib/lg-c5-home/screensaver
DST=/usr/palm/applications/com.webos.app.screensaver
LOG=/tmp/gathin-screensaver.log

[ -f "$SRC/index.html" ] || { echo "screensaver app missing" >"$LOG"; exit 0; }

# Drop the previous mount before replacing the staged files, otherwise the
# currently mounted copy would keep serving the old page.
if grep -q " $DST " /proc/mounts; then
  umount -l "$DST" 2>/dev/null || true
fi

rm -rf "$STATE"
mkdir -p "$STATE"
cp -a "$SRC/." "$STATE/"
[ -f "$STATE/index.html" ] || { echo "screensaver copy failed" >"$LOG"; exit 0; }

mount --bind "$STATE" "$DST" || { echo "screensaver mount failed" >"$LOG"; exit 0; }

# as-home.sh restarts sam after mounting both apps; a second restart here can
# block while an HDMI input is foreground.
echo "screensaver mounted" >>"$LOG"
exit 0
