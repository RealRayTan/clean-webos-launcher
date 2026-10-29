#!/bin/sh
# Apply or revert system debloat, preload policy, and ad suppression.
# Strictly preserves sdx (Settings UI dependency) and ss.gateway (DIAL casting).
set -eu
ACTION="${1:-on}"
LOG=/tmp/gathin-optimize.log
STATE=/var/lib/lg-c5-home

mkdir -p "$STATE"

UNITS="
com.webos.service.mycar.service
com.webos.service.buddyconnector.service
alwaysready.service
ai-inference-manager.service
service-logger.service
rdxd.service
dmost.service
com.webos.service.ruleengine.service
"

PRELOAD_APPS="
youtube.leanback.v4
com.webos.app.lgchannels
"

if [ "$ACTION" = "on" ]; then
  echo "Applying system optimizations" >>"$LOG"

  # 1. Disable memory-heavy background preloads
  for app in $PRELOAD_APPS; do
    luna-send -n 1 -w 3000 luna://com.webos.service.preloadmanager/setPreloadPolicy \
      "{\"application\":{\"id\":\"$app\",\"isEnabled\":false}}" >>"$LOG" 2>&1 || true
  done

  # 2. Stop non-essential vendor telemetry and background units
  for unit in $UNITS; do
    systemctl stop "$unit" >>"$LOG" 2>&1 || true
  done

  # 3. Suppress system promotional banners, ads, and nudges
  PAYLOAD='{"category":"general","settings":{"homePromotion":"off","screenSaverAd":"off","adCookie":"off","aiNudge":"off","livePromotion":"off","lmt":"on"}}'
  luna-send -n 1 -w 4000 luna://com.webos.settingsservice/setSystemSettings "$PAYLOAD" >>"$LOG" 2>&1 || true

  touch "$STATE/optimized"
  echo "System optimizations applied" >>"$LOG"
  exit 0
elif [ "$ACTION" = "off" ]; then
  echo "Reverting system optimizations" >>"$LOG"

  # 1. Re-enable preload policies
  for app in $PRELOAD_APPS; do
    luna-send -n 1 -w 3000 luna://com.webos.service.preloadmanager/setPreloadPolicy \
      "{\"application\":{\"id\":\"$app\",\"isEnabled\":true}}" >>"$LOG" 2>&1 || true
  done

  # 2. Restart stopped units
  for unit in $UNITS; do
    systemctl start "$unit" >>"$LOG" 2>&1 || true
  done

  rm -f "$STATE/optimized"
  echo "System optimizations reverted" >>"$LOG"
  exit 0
else
  echo "Usage: $0 [on|off]" >&2
  exit 1
fi
