# LG webOS Minimalist Poster Desktop

> An immersive poster launcher crafted for rooted LG webOS TVs. Eliminate stock advertisements, free up system memory, and unlock the full potential of OLED displays.

[简体中文](README.md) | **English**

Current hardware and repository version: **v1.5.9**. Target platforms: LG webOS 24 and webOS 25 (Verified on hardware: LG OLED42C5XCA).

---

## Why Replace the Stock Home?

LG stock webOS home features intrusive commercial promos, rotating banners, and background telemetry. Exiting apps often causes stutter and flashes the vendor storefront.

This project uses non-destructive bind mounts to replace the stock home with a fast, uncluttered poster desktop. The desktop runs directly on the TV Linux system without requiring an external streaming box or an always-on computer.

| Dimension | LG Stock webOS Home | This Poster Desktop (v1.5.9) |
|---|---|---|
| **Startup Speed** | Waits for sponsored cards and ad networks to load | Reaches the desktop in seconds with zero ads |
| **App Exits** | Returns to the heavy vendor home screen | Lands directly on the desktop and preserves context |
| **Available RAM** | Typically only ~450 MB remains free after boot | **Stably verified at 750 to 800 MB free** (~80% gain) |
| **OLED Visuals** | Bright clutter and gray backgrounds | Pure OLED Black theme with true off pixels |
| **Burn-in Protection** | Stock clocks are often occluded by app dialogs | Standalone system screen saver with 25s floating drift |
| **Multi-Device Support** | Reboots frequently drop active HDMI inputs | Wake from standby cleanly preserves HDMI inputs and labels |
| **Firmware Safety** | Traditional hacks modify read-only system partitions | **Read-only Bind Mounts** with one-step full restoration |

---

## Core Capabilities

### 1. True System Home Replacement
- **Native Mount**: Bind-mounts over `com.webos.app.home`. Short-pressing Home, booting up, or exiting an app goes straight to the desktop without stock home flashes.
- **Persistent Flash Staging**: Mount staging lives in flash storage at `/var/lib/lg-c5-home/system-home` rather than RAM-backed tmpfs, reclaiming physical memory.
- **Emergency Escape Hatch**: Short Back presses are left entirely to third-party apps. Long-pressing Back for 0.7s provides a reliable escape route back to the desktop, eliminating black-screen deadlocks.

### 2. Immersive Dynamic Posters and Discovery Radar
- **Multi-Platform Covers**: Asynchronously fetches dynamic backdrops from Bilibili, YouTube NASA RSS, Netflix Top 10, Apple TV Press, and TMDB (Prime Video, Disney+, Max).
- **Smooth Auto-Carousel**: Resting on apps with multiple titles smoothly crossfades between featured artworks every 10 seconds, updating titles and summaries in lockstep.
- **Trending Cinema Hall**: Tap right on the main menu to enter the full-screen discovery hall, featuring weekly movies and TV shows with original titles, TMDB ratings, and descriptions.
- **Network Resilience and SOCKS5 Proxy**: Automatically queries Alcyone local SOCKS5 loopback on port 10801 to route restricted poster domains through proxy, while keeping public domestic sources direct.

### 3. Lightweight 60 FPS Television Rendering Engine
- **Bounded LRU Texture Pool (`app/pool.js`)**: Limits resident memory to 8 home covers and 10 discovery cards. Evicted items explicitly detach GPU texture handles via `src = ''` to prevent memory leaks.
- **Sequential Async Preloading (`PreloadQueue`)**: Processes image decodes one at a time via single-task FIFO scheduling, pausing during remote navigation to maintain 60 FPS scrolling.
- **Zero Real-Time Gaussian Blurring**: Replaces expensive 1080p CSS blur filters and heavy card drop-shadows with static pre-darkened layers and compositor transitions.

### 4. Deep System Debloating and Kernel RAM Management
- **Preload Policy Override**: Suppresses background preloads for YouTube and LG Channels via Luna API calls, stopping idle background apps from consuming over 160 MB of RAM.
- **Safe Daemon Pruning**: Safely stops 8 unneeded telemetry units such as `service-logger`, `ai-inference-manager`, and `alwaysready`, while disabling vendor ad switches.
- **One-Click and Idle Kernel Cache Reclamation**: The drawer menu offers a Clean RAM button to drop PageCache and compact memory with root privileges. The daemon automatically runs silent cleanups after 5 minutes of idle time on the desktop or screen saver.
- **Strict Safety Boundaries**: Explicitly protects `sdx` (preserving Settings gear menu functionality) and `ss.gateway` (preserving DIAL phone casting).

### 5. Tailored OLED Aesthetics and Screen Saver
- **Four Distinct Themes**: Features Auto, Dark, Cold-stone Light, and Pure OLED Black.
- **System-Level Screen Saver**: Replaces `com.webos.app.screensaver` with a pure-black floating clock. System idle triggers the screen saver after 3 minutes, floating every 25 seconds and waking on any button press.
- **Live Local Weather**: Reads local weather conditions and dynamically matches theme transitions to sunset and sunrise times.

---

## Interface Preview

| LG Stock Home (Vendor Clutter) | Custom Desktop (Cold-stone Light) | Pure Black Screen Saver |
|---|---|---|
| [![LG stock home](docs/images/lg-home.png)](docs/images/lg-home.png) | [![Custom desktop](docs/images/poster-home-1.5.3.png)](docs/images/poster-home-1.5.3.png) | [![Screen saver](docs/images/screensaver-1.5.3.png)](docs/images/screensaver-1.5.3.png) |

---

## Quick Start

### Prerequisites
1. Rooted LG webOS TV with **Homebrew Channel** installed.
2. SSH service enabled in Homebrew Channel settings (default port 22, public key authentication recommended).
3. Local development environment with Python 3.12 and Node.js 22.

### Installation
1. Configure connection targets (environment variables take precedence, or use `Host lgtv` in `~/.ssh/config`):
   ```sh
   export TV_HOST='192.168.x.x'
   export TV_SSH_KEY='/path/to/your/key'
   ```
2. Install dependencies and verify native binaries:
   ```sh
   npm install --global @webos-tools/cli
   python3 -m venv .venv
   .venv/bin/pip install -r requirements.txt
   python3 scripts/prepare_native.py /path/to/native-artifact
   ```
3. Build the release package and deploy to the TV:
   ```sh
   bash scripts/build.sh
   .venv/bin/python tools/install.py
   ```
The installer mounts the components immediately without requiring a reboot. Press Home on the remote to begin.

### Rollback and Mode Switches
- **Restore stock Home and stock screen saver**:
  ```sh
  .venv/bin/python tools/desktop_mode.py off
  ```
- **Re-enable custom desktop**:
  ```sh
  .venv/bin/python tools/desktop_mode.py on
  ```
- **Restore stock screen saver only**:
  ```sh
  .venv/bin/python tools/screensaver_mode.py off
  ```

---

## Daily Remote Navigation

| Remote Button | Action and Response |
|---|---|
| **Short Press Home** | Opens the custom poster desktop in seconds |
| **Long Press Home** | Preserves the system default long-press path |
| **Short Press Back in App** | Handled natively by the third-party application |
| **Stuck or Frozen App** | **Hold Back for ~0.7s** to force exit back to the desktop |
| **Wake from Standby** | Restores the desktop if active before sleep, or preserves HDMI inputs |
| **Right Arrow on Main Menu** | Quick jump to the Trending Cinema discovery hall |
| **Drawer Menu Clean RAM** | Reclaims kernel PageCache memory and compacts memory fragments |

---

## Local Development and Verification

Run local checks on your computer without connecting to the TV:

```sh
node --test tests/*.cjs
python3 -m compileall -q tools scripts
bash -n scripts/build.sh service/autostart.sh service/as-home.sh service/screensaver-as-system.sh service/optimize.sh
```

---

## Architectural Documentation

- [Home Interception and Recovery Architecture](docs/architecture.md)
- [Installation and Deployment Guide](docs/install.md)
- [Native Dependency Verification and Checksums](docs/native.md)
- [Streaming Catalog Configuration](docs/streaming-catalog.md)
- [Hardware Verification and Benchmark Records](docs/verification.md)
- [Project Evolution Record](docs/project-record.md)
- [Changelog](CHANGELOG.md)

---

## Upstream and Licenses

The frontend originated from webos-vibehack. Native components are inputhookpp and ezinject. Detailed license information and asset attributions are in [Credits](docs/credits.md).

Custom code and launcher enhancements are released under the MIT License in [LICENSE](LICENSE) and [upstream license](licenses/webos-vibehack-MIT.txt). Bundled fonts adhere to SIL OFL 1.1. Native dependencies follow their respective licenses. This project is not affiliated with LG Electronics.
