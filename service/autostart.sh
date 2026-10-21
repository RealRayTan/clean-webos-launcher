#!/bin/sh
set -eu
SVCDIR=/media/developer/apps/usr/palm/services/com.gathin.tvhome.service
STATE=/var/lib/lg-c5-home
mkdir -p "$STATE"
[ ! -e "$STATE/disabled" ] || exit 0
[ -f "$SVCDIR/service.js" ] || exit 0
# A held lock prevents duplicate helpers on repeated startup attempts.
(
  flock -n 9 || exit 0
  export NODE_PATH=/usr/lib/node_modules:/usr/lib/nodejs
  cd "$SVCDIR"
  echo $$ > /tmp/lg-c5-home-wrapper.pid
  exec /usr/bin/node service.js --remote-only
) 9>/tmp/lg-c5-home.lock </dev/null >/tmp/lg-c5-home.stdout 2>&1 &
exit 0
