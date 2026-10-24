#!/usr/bin/env python3
"""Inspect LG webOS system performance, memory, preloads and telemetry settings."""
from __future__ import annotations

import argparse
import json
import re
import sys
from tv_control import call, remote


def parse_meminfo(content: str) -> dict[str, int]:
    info: dict[str, int] = {}
    for line in content.splitlines():
        match = re.match(r'^([A-Za-z0-9_()]+):\s+(\d+)\s+kB', line.strip())
        if match:
            info[match.group(1)] = int(match.group(2))
    return info


def inspect_home_memory(running_apps: list[dict] | None = None) -> dict[str, int | str]:
    pid = 0
    if running_apps:
        for app in running_apps:
            if app.get("id") in ("com.webos.app.home", "com.gathin.tvhome"):
                raw_pid = app.get("processid") or app.get("webprocessid")
                if raw_pid and str(raw_pid).isdigit():
                    pid = int(raw_pid)
                    break
    if not pid:
        res = remote("for p in /proc/[0-9]*; do [ -d \"$p\" ] || continue; "
                     "case \"$(cat $p/cmdline 2>/dev/null)\" in *app-id=com.webos.app.home*|*com.gathin.tvhome*) echo ${p##*/}; break;; esac; done")
        val = res.stdout.decode().strip()
        if val and val.isdigit():
            pid = int(val)
    if not pid:
        return {"pid": 0, "pss_kb": 0, "rss_kb": 0}

    stats = remote(f"grep -E '^(VmRSS|VmHWM):' /proc/{pid}/status 2>/dev/null; awk '/Pss:/ {{sum+=$2}} END {{print \"Pss:\", sum}}' /proc/{pid}/smaps 2>/dev/null").stdout.decode()
    pss, rss = 0, 0
    for line in stats.splitlines():
        if "Pss:" in line:
            m = re.search(r'\d+', line)
            if m:
                pss = int(m.group())
        elif line.startswith("VmRSS:"):
            m = re.search(r'\d+', line)
            if m:
                rss = int(m.group())
    return {"pid": pid, "pss_kb": pss, "rss_kb": rss}


def inspect_preloads() -> dict[str, bool]:
    try:
        policy = call("luna://com.webos.service.preloadmanager/getPreloadPolicy", timeout=3)
        apps = policy.get("apps", policy.get("applications", []))
        if isinstance(apps, list):
            return {a.get("id"): a.get("isEnabled", True) for a in apps if isinstance(a, dict) and "id" in a}
        if isinstance(apps, dict):
            return {k: v.get("isEnabled", True) if isinstance(v, dict) else bool(v) for k, v in apps.items()}
    except Exception:
        pass
    return {}


def inspect_settings() -> dict[str, str]:
    keys = {
        "general": ["homePromotion", "sportsAlarm"],
        "option": ["livePromotion", "webOSPromotionVideo", "promotionStreamer", "livePlus"],
        "other": ["contentRecommendation"],
    }
    values: dict[str, str] = {}
    for category, key_list in keys.items():
        try:
            resp = call("luna://com.webos.settingsservice/getSystemSettings",
                        {"category": category, "keys": key_list}, timeout=3)
            settings = resp.get("settings", {})
            for k in key_list:
                if k in settings:
                    values[f"{category}:{k}"] = str(settings[k])
        except Exception:
            pass
    return values


def inspect_running() -> list[dict]:
    try:
        resp = call("luna://com.webos.service.applicationmanager/running", timeout=3)
        return resp.get("running", [])
    except Exception:
        return []


def collect_profile() -> dict:
    meminfo_raw = remote("cat /proc/meminfo").stdout.decode()
    meminfo = parse_meminfo(meminfo_raw)
    raw_running = inspect_running()
    running_apps = [app.get("id", "") for app in raw_running if isinstance(app, dict) and app.get("id")]
    home_mem = inspect_home_memory(raw_running)
    preloads = inspect_preloads()
    settings = inspect_settings()

    mem_avail_kb = meminfo.get("MemAvailable", meminfo.get("MemFree", 0))
    mem_total_kb = meminfo.get("MemTotal", 1)

    return {
        "memory": {
            "total_mb": mem_total_kb // 1024,
            "available_mb": mem_avail_kb // 1024,
            "free_mb": meminfo.get("MemFree", 0) // 1024,
            "available_percent": round(mem_avail_kb / mem_total_kb * 100, 1),
            "swap_free_mb": meminfo.get("SwapFree", 0) // 1024,
            "swap_total_mb": meminfo.get("SwapTotal", 0) // 1024,
        },
        "home_process": {
            "pid": home_mem["pid"],
            "pss_mb": round(home_mem["pss_kb"] / 1024, 1),
            "rss_mb": round(home_mem["rss_kb"] / 1024, 1),
        },
        "running_apps_count": len(running_apps),
        "running_apps": running_apps,
        "preloads": preloads,
        "settings": settings,
    }


def print_report(data: dict):
    mem = data["memory"]
    home = data["home_process"]
    print("=" * 60)
    print(" LG webOS 性能与系统资源基准报告")
    print("=" * 60)
    print("【内存使用情况】")
    print(f"  物理总内存 (MemTotal)     : {mem['total_mb']} MiB")
    print(f"  可用内存 (MemAvailable)   : {mem['available_mb']} MiB ({mem['available_percent']}%)")
    print(f"  空闲内存 (MemFree)        : {mem['free_mb']} MiB")
    print(f"  Swap 可用                 : {mem['swap_free_mb']} / {mem['swap_total_mb']} MiB")
    print("\n【桌面进程 (com.webos.app.home)】")
    if home["pid"]:
        print(f"  PID                       : {home['pid']}")
        print(f"  物理内存 (PSS)            : {home['pss_mb']} MiB")
        print(f"  常驻内存 (RSS)            : {home['rss_mb']} MiB")
    else:
        print("  进程未运行")

    print(f"\n【前后台运行应用数】: {data['running_apps_count']} 个")
    if data["running_apps"]:
        for app in data["running_apps"]:
            print(f"  - {app}")

    print("\n【预加载策略 (Preload Policy)】")
    if data["preloads"]:
        for app_id, enabled in sorted(data["preloads"].items()):
            status = "已开启 (常驻)" if enabled else "已关闭"
            print(f"  {app_id:<32}: {status}")
    else:
        print("  无自定义预加载或未能读取")

    print("\n【遥测、推广与 ACR 设置】")
    if data["settings"]:
        for key, val in sorted(data["settings"].items()):
            desc = " (已关闭)" if val == "off" else (" (正在运行)" if val == "on" else "")
            print(f"  {key:<32}: {val}{desc}")
    else:
        print("  未能读取系统设置")
    print("=" * 60)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--json", action="store_true", help="输出原始 JSON 数据")
    args = parser.parse_args()

    try:
        data = collect_profile()
        if args.json:
            print(json.dumps(data, indent=2, ensure_ascii=False))
        else:
            print_report(data)
    except ValueError as err:
        print(f"配置错误: {err}", file=sys.stderr)
        return 1
    except Exception as err:
        print(f"远程采样失败: {err}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
