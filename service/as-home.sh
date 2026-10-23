#!/bin/sh
# Mount the launcher over LG's Flutter Home app, so Back from an app and the
# system Home button both land on the launcher without an LG-home frame.
# Nothing on disk is changed; the bind mounts disappear on reboot or unmount.
set -eu
SRC=/media/developer/apps/usr/palm/applications/com.gathin.tvhome
DST=/usr/palm/applications/com.webos.app.home
TMP=/tmp/gathin-home-as-home
STATE=/var/lib/lg-c5-home
LOG=/tmp/gathin-home-as-home.log
NODE=/usr/bin/node

[ -f "$SRC/index.html" ] || { echo "launcher not installed; leaving LG Home alone" >"$LOG"; exit 0; }
if grep -q " $DST " /proc/mounts; then
  OLD=$("$NODE" -e 'try{process.stdout.write(require(process.argv[1]).version)}catch(e){}' "$TMP/appinfo.json" 2>/dev/null || true)
  NEW=$("$NODE" -e 'try{process.stdout.write(require(process.argv[1]).version)}catch(e){}' "$SRC/appinfo.json" 2>/dev/null || true)
  if [ "$OLD" = "$NEW" ]; then echo "already mounted" >"$LOG"; exit 0; fi
  umount -l "$DST" 2>/dev/null || true
  umount -l "$SRC/appinfo.json" 2>/dev/null || true
fi

rm -rf "$TMP"
mkdir -p "$TMP"
cp -a "$SRC/." "$TMP/" || exit 0
rm -rf "$TMP/content-cache"
mkdir -p "$SRC/content-cache"
ln -sfn "$SRC/content-cache" "$TMP/content-cache"

# The copy must present LG Home's app id to the application manager.
"$NODE" - "$TMP/appinfo.json" <<'EOF'
var fs = require('fs'), file = process.argv[2];
var app = JSON.parse(fs.readFileSync(file, 'utf8'));
app.id = 'com.webos.app.home';
app.title = 'Home';
app.visible = false;
app.appCategory = ['home'];
app.handlesRelaunch = true;
app.class = Object.assign({}, app.class || {}, { hidden: true });
fs.writeFileSync(file, JSON.stringify(app, null, 2));
EOF
grep -q '"com.webos.app.home"' "$TMP/appinfo.json" || { echo "appinfo rewrite failed" >"$LOG"; exit 0; }
mount --bind "$TMP" "$DST" || exit 0

# The normal launcher app remains installed for its service and data, but stays
# out of the app list while its content is acting as Home.
"$NODE" - "$SRC/appinfo.json" >/tmp/gathin-regular-appinfo.json <<'EOF'
var fs = require('fs'), file = process.argv[2];
var app = JSON.parse(fs.readFileSync(file, 'utf8'));
app.visible = false;
app.class = Object.assign({}, app.class || {}, { hidden: true });
process.stdout.write(JSON.stringify(app, null, 2));
EOF
mount --bind /tmp/gathin-regular-appinfo.json "$SRC/appinfo.json" || true

mkdir -p "$STATE"
touch "$STATE/system-home"
rm -f "$STATE/native-enabled"
# Use the original Home key path; the launcher is now the system Home itself.
if [ -f "$STATE/keybinds.before.json" ]; then
  mkdir -p /home/root/.config/lginputhook
  cp "$STATE/keybinds.before.json" /home/root/.config/lginputhook/keybinds.json
else
  "$NODE" - /home/root/.config/lginputhook/keybinds.json <<'EOF'
var fs = require('fs'), file = process.argv[2], config = {};
try { config = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (error) {}
delete config['773'];
try { fs.writeFileSync(file, JSON.stringify(config)); } catch (error) {}
EOF
fi

systemctl restart sam >>"$LOG" 2>&1 && echo "restarted sam" >>"$LOG"

SVC=/media/developer/apps/usr/palm/services/com.gathin.tvhome.service/autostart.sh
[ -f "$SVC" ] && sh "$SVC" </dev/null >/dev/null 2>&1 && echo "started launcher service" >>"$LOG"

ORIG="$STATE/boot-input.orig"
if [ ! -f "$ORIG" ]; then
  luna-send -n 1 -w 5000 luna://com.webos.settingsservice/getSystemSettings \
    '{"category":"general","keys":["lastInputApp","physicalLastInputApp","homeAutoLaunch"]}' >"$ORIG" 2>/dev/null || true
fi
luna-send -n 1 -w 5000 luna://com.webos.settingsservice/setSystemSettings \
  '{"category":"general","settings":{"lastInputApp":"com.webos.app.home","physicalLastInputApp":"com.webos.app.home","homeAutoLaunch":"off"}}' >/dev/null 2>&1 \
  && echo "boot input set to launcher" >>"$LOG"
echo "launcher mounted as system Home" >>"$LOG"
exit 0
