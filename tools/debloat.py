#!/usr/bin/env python3
"""Reversible debloat for LG webOS: disable preloads, telemetry/ACR and promos."""
from __future__ import annotations

import argparse
import json
import sys
from tv_control import call, remote

BACKUP_DIR = "/var/lib/webos-debloat"
STATE_FILE = f"{BACKUP_DIR}/state"
SETTINGS_ORIG = f"{BACKUP_DIR}/settings.orig.json"
PRELOAD_CONF = "/var/preferences/webos-preload-manager-conf.json"
PRELOAD_ORIG = f"{BACKUP_DIR}/webos-preload-manager-conf.orig"
BOOT_HOOK = "/var/lib/webosbrew/init.d/50-debloat"

TARGET_PRELOADS = [
    "com.webos.app.lgchannels",
    "com.webos.app.browser",
]

TARGET_SETTINGS = [
    ("general", "homePromotion"),
    ("general", "sportsAlarm"),
    ("option", "livePromotion"),
    ("option", "webOSPromotionVideo"),
    ("option", "promotionStreamer"),
    ("option", "livePlus"),
    ("other", "contentRecommendation"),
]

PROTECTED_IDS = {
    "com.webos.app.home",
    "com.gathin.tvhome",
    "com.webos.app.livetv",
    "com.palm.app.settings",
    "com.webos.app.settings",
    "com.webos.app.hdmi1",
    "com.webos.app.hdmi2",
    "com.webos.app.hdmi3",
    "com.webos.app.hdmi4",
    "org.webosbrew.hbchannel",
}


def cmd_plan():
    print("=" * 60)
    print(" LG webOS 优化瘦身计划 (Debloat Plan)")
    print("=" * 60)
    print("【常驻预加载停用 (释放物理内存)】")
    for app in TARGET_PRELOADS:
        print(f"  - 停用预加载并关闭驻留: {app}")
    print("\n【遥测、推广与 ACR 关闭 (降低后台 CPU 开销)】")
    for cat, key in TARGET_SETTINGS:
        print(f"  - 设置 {cat}:{key} => off")
    print("\n【开机持久化钩子】")
    print(f"  - 安装脚本: {BOOT_HOOK}")
    print("\n【备份保护】")
    print(f"  - 原始配置文件备份目录: {BACKUP_DIR}")
    print("=" * 60)
    print("执行 'python3 tools/debloat.py apply' 开始应用优化。")


def cmd_status():
    print("=" * 60)
    print(" LG webOS 优化瘦身状态 (Debloat Status)")
    print("=" * 60)
    applied = remote(f"[ -f {STATE_FILE} ] && echo yes || echo no").stdout.decode().strip() == "yes"
    hook_installed = remote(f"[ -x {BOOT_HOOK} ] && echo yes || echo no").stdout.decode().strip() == "yes"
    print(f"当前优化状态: {'已应用 (Debloated)' if applied else '未应用 (Stock)'}")
    print(f"开机自启钩子: {'已就绪' if hook_installed else '未安装'}")

    print("\n【目标预加载项状态】")
    try:
        policy = call("luna://com.webos.service.preloadmanager/getPreloadPolicy", timeout=3)
        apps = policy.get("apps", policy.get("applications", []))
        enabled_map = {}
        if isinstance(apps, list):
            enabled_map = {a.get("id"): a.get("isEnabled", True) for a in apps if isinstance(a, dict) and "id" in a}
        elif isinstance(apps, dict):
            enabled_map = {k: v.get("isEnabled", True) if isinstance(v, dict) else bool(v) for k, v in apps.items()}
        for app in TARGET_PRELOADS:
            status = "开启 (常驻)" if enabled_map.get(app, True) else "已停用 (释放)"
            print(f"  {app:<32}: {status}")
    except Exception as err:
        print(f"  无法读取预加载服务状态: {err}")

    print("\n【目标系统设置状态】")
    for cat, key in TARGET_SETTINGS:
        try:
            resp = call("luna://com.webos.settingsservice/getSystemSettings",
                        {"category": cat, "keys": [key]}, timeout=3)
            val = resp.get("settings", {}).get(key, "unknown")
            desc = "已关闭 (优化)" if val == "off" else "已开启"
            print(f"  {f'{cat}:{key}':<32}: {val} ({desc})")
        except Exception:
            print(f"  {f'{cat}:{key}':<32}: 读取失败")
    print("=" * 60)


def cmd_apply():
    print("正在对电视进行无损性能优化...")
    remote(f"mkdir -p {BACKUP_DIR}")

    # 1. 备份预加载配置
    remote(
        f"if [ -f {PRELOAD_CONF} ] && [ ! -f {PRELOAD_ORIG} ]; then "
        f"cp {PRELOAD_CONF} {PRELOAD_ORIG}; fi"
    )

    # 2. 备份设置项原始值
    orig_settings: dict[str, str] = {}
    check_orig = remote(f"[ -f {SETTINGS_ORIG} ] && echo yes || echo no").stdout.decode().strip()
    if check_orig != "yes":
        for cat, key in TARGET_SETTINGS:
            try:
                resp = call("luna://com.webos.settingsservice/getSystemSettings",
                            {"category": cat, "keys": [key]}, timeout=3)
                val = resp.get("settings", {}).get(key)
                if val is not None:
                    orig_settings[f"{cat}:{key}"] = str(val)
            except Exception:
                pass
        # Write orig_settings to file
        orig_json = json.dumps(orig_settings, indent=2)
        remote(f"cat << 'EOF' > {SETTINGS_ORIG}\n{orig_json}\nEOF")

    # 3. 停用预加载并关闭驻留
    print("正在停用后台预加载应用...")
    for app in TARGET_PRELOADS:
        if app in PROTECTED_IDS:
            continue
        try:
            call("luna://com.webos.service.preloadmanager/setPreloadPolicy",
                 {"application": {"id": app, "isEnabled": False}}, timeout=3)
        except Exception as e:
            print(f"  [warn] setPreloadPolicy for {app}: {e}")
        try:
            call("luna://com.webos.service.applicationmanager/closeByAppId",
                 {"id": app}, timeout=3)
        except Exception:
            pass

    # 持久化到 PRELOAD_CONF 的 allowedApps
    node_update_conf = (
        "try {"
        f"  var fs = require('fs'), path = '{PRELOAD_CONF}';"
        "  if (fs.existsSync(path)) {"
        "    var conf = JSON.parse(fs.readFileSync(path, 'utf8'));"
        "    conf.allowedApps = conf.allowedApps || {};"
        f"    {json.dumps(TARGET_PRELOADS)}.forEach(function(id) {{ conf.allowedApps[id] = false; }});"
        "    fs.writeFileSync(path, JSON.stringify(conf, null, 2));"
        "  }"
        "} catch(e) {}"
    )
    remote(f"node -e {json.dumps(node_update_conf)}")

    # 4. 关闭推广、推荐与 ACR (livePlus)
    print("正在关闭后台 ACR 画面分析与推广设置...")
    for cat, key in TARGET_SETTINGS:
        try:
            call("luna://com.webos.settingsservice/setSystemSettings",
                 {"category": cat, "settings": {key: "off"}}, timeout=3)
            print(f"  已关闭 {cat}:{key}")
        except Exception as e:
            print(f"  [warn] 关闭 {cat}:{key} 失败: {e}")

    # 5. 安装开机持久化钩子
    print("正在写入开机自启钩子...")
    hook_script = f"""#!/bin/sh
# Auto-generated by webos-debloat. Re-applies preload policy and settings at boot.
sleep 4
{'; '.join([f'luna-send -n 1 luna://com.webos.service.preloadmanager/setPreloadPolicy \'{{"application":{{"id":"{app}","isEnabled":false}}}}\' >/dev/null 2>&1' for app in TARGET_PRELOADS])}
{'; '.join([f'luna-send -n 1 luna://com.webos.settingsservice/setSystemSettings \'{{"category":"{cat}","settings":{{"{key}":"off"}}}}\' >/dev/null 2>&1' for cat, key in TARGET_SETTINGS])}
exit 0
"""
    remote(f"mkdir -p $(dirname {BOOT_HOOK})")
    remote(f"cat << 'EOF' > {BOOT_HOOK}\n{hook_script}\nEOF")
    remote(f"chmod 755 {BOOT_HOOK}")
    remote(f"touch {STATE_FILE}")

    print("优化应用完成。")


def cmd_restore():
    print("正在恢复原厂设置与预加载策略...")

    # 1. 移除开机钩子与状态
    remote(f"rm -f {BOOT_HOOK} {STATE_FILE}")

    # 2. 恢复预加载配置
    remote(
        f"if [ -f {PRELOAD_ORIG} ]; then "
        f"cp {PRELOAD_ORIG} {PRELOAD_CONF}; "
        f"rm -f {PRELOAD_ORIG}; fi"
    )
    for app in TARGET_PRELOADS:
        try:
            call("luna://com.webos.service.preloadmanager/setPreloadPolicy",
                 {"application": {"id": app, "isEnabled": True}}, timeout=3)
        except Exception:
            pass

    # 3. 恢复原始设置项
    orig_raw = remote(f"cat {SETTINGS_ORIG} 2>/dev/null").stdout.decode().strip()
    if orig_raw:
        try:
            orig_settings = json.loads(orig_raw)
            for k, val in orig_settings.items():
                cat, key = k.split(":", 1)
                try:
                    call("luna://com.webos.settingsservice/setSystemSettings",
                         {"category": cat, "settings": {key: val}}, timeout=3)
                    print(f"  已恢复 {cat}:{key} => {val}")
                except Exception:
                    pass
        except Exception as e:
            print(f"  读取备份设置失败: {e}")
        remote(f"rm -f {SETTINGS_ORIG}")

    print("已成功恢复原厂设置。")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=["status", "plan", "apply", "restore"],
                        help="操作: status(状态), plan(预演), apply(应用), restore(复原)")
    args = parser.parse_args()

    try:
        if args.action == "status":
            cmd_status()
        elif args.action == "plan":
            cmd_plan()
        elif args.action == "apply":
            cmd_apply()
        elif args.action == "restore":
            cmd_restore()
    except ValueError as err:
        print(f"配置错误: {err}", file=sys.stderr)
        return 1
    except Exception as err:
        print(f"操作失败: {err}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
