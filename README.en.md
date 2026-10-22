# LG webOS desktop

[简体中文](README.md) | **English**

A Chinese-language tile launcher for LG webOS TVs. On a rooted TV, it also handles the Home button and remembers whether you used the launcher or an HDMI input before standby. The current source and tested TV installation are **1.3.0**. The interface is Chinese; this page provides English documentation.

The project started from [webos-vibehack](https://github.com/OmkarK97/webos-vibehack). It adds Chinese font fallbacks, a TV-side Home helper, app management, and dynamic content tiles. After installation, the launcher runs on the TV without a computer.

## Current desktop

![Version 1.3.0 on an LG C5, with a live Prime Video catalog cover](docs/images/tile-home-1.3.0.png)

The HDMI shortcut stays on the left. App tiles form a continuous two-row shelf on the right. Additional apps scroll horizontally without page numbers or stretched tiles. The bottom row opens all apps, inputs, VPN, and settings.

The automatic theme uses the TV's local time: light from 07:00 to 19:00, dark at other times. You can also keep either theme selected. Wallpapers include a valley, misty mountains, and a solid background. App icons supply colors for separate light and dark palettes, with neutral fallbacks when an icon cannot be read.

Dynamic tiles use public catalogs and feeds. They do not read personal streaming accounts or viewing history. Prime Video, Disney+, and HBO Max share a TMDB adapter, configured for the US catalog. Without TMDB credentials, these apps keep their brand tiles. See [streaming catalog setup, in Chinese](docs/streaming-catalog.md).

## Stock home and current desktop

Both images are original captures from the same LG C5. The stock home was captured on October 21, 2026. The custom desktop is version 1.3.0, captured on October 22, 2026, with a real Prime Video catalog cover. Open either image for its original size.

| LG stock home | Custom desktop 1.3.0 |
|---|---|
| [![LG stock home](docs/images/lg-home.png)](docs/images/lg-home.png) | [![Custom desktop with dynamic covers](docs/images/tile-home-1.3.0.png)](docs/images/tile-home-1.3.0.png) |

Screenshots show the layout. They do not establish Home-button behavior or standby recovery. Those observations are documented in the [verification record, in Chinese](docs/verification.md).

## Home button and standby behavior

| Action | Result |
|---|---|
| Short press on the physical Home button | Open the custom desktop |
| Hold Home for about one second, then release | Open LG's stock home |
| Enter standby from the custom desktop, then wake | Restore the custom desktop |
| Enter standby from HDMI, then wake | Let LG restore the last input |
| Exit an app opened from the custom desktop | Return to the custom desktop; tested with Bilibili |
| Exit an app opened from LG's stock home | Preserve LG's return behavior |
| Disable the desktop integration | Remove custom startup hooks and the input lease; keep root and installed apps |

Back-button behavior inside third-party apps depends on those apps. YouTube AdFree and Alcyone do not provide a top-level exit prompt in the tested versions. Short-press Home to return to the desktop. Leaving the VPN interface does not disconnect the VPN.

The desktop dims after three minutes of inactivity. It does not change the TV's OLED protection settings.

## App management

Choose **编辑桌面** at the upper right to add or remove home tiles. Hiding a tile does not uninstall the app. **全部应用** keeps the complete app list. New apps receive the same tile dimensions and automatic color treatment.

Hold the confirm button on an app tile for about 0.6 seconds to reorder it. The edit panel also has a reorder action. Use the up and down buttons to move an app, confirm to save, or Back to cancel. Reopen the desktop after installing an app, or refresh the app list manually.

App selection, order, wallpaper, and theme are stored locally on the TV. If the app list cannot be loaded, the launcher keeps its cached list.

## Compatibility and limits

The tested device is an LG OLED42C5XCA running webOS SDK 11.2.0 and firmware 43.21.73. Its kernel is aarch64, but the input process and relevant user-space dependencies are ARM32. Kernel architecture alone does not identify the required native modules.

Installation requires an already rooted TV, Homebrew Channel, and SSH key access. This repository does not include a root tool, third-party native binaries, or a ready-made IPK. Other TV models and firmware versions have not been verified.

Known limits include Home holds longer than six seconds, no automatic supervisor restart after a helper crash, and no restoration of playback position inside third-party apps. The current recovery logic has standby acceptance records, but no complete cold-boot acceptance record. Root reversibility and warranty coverage are not guaranteed.

## Documentation

The detailed guides below are currently in Chinese.

- [Install on a rooted TV](docs/install.md): sync apps, prepare dependencies, build, install, and disable.
- [Home handling and recovery architecture](docs/architecture.md).
- [Native dependency versions and checksums](docs/native.md).
- [Shared streaming catalog setup](docs/streaming-catalog.md).
- [Project history](docs/project-record.md).
- [Verification scope](docs/verification.md).
- [Changelog](CHANGELOG.md).

## Local checks

These checks use Node.js 22 and Python 3.12. They do not connect to a TV.

```sh
node --test tests/*.cjs
python3 -m compileall -q tools scripts
bash -n scripts/build.sh service/autostart.sh
```

`app/apps.example.js` contains one LG stock-home example. The real app list and icons are synced locally from your TV. The example is not a live inventory. `computerInput` in `app/config.js` selects the left-hand HDMI shortcut.

## Upstream projects and credits

The table distinguishes source code, external dependencies, design references, and separately installed TV apps. Root tools and independent apps are not distributed with this repository.

| Repository | Role in this project |
|---|---|
| [OmkarK97/webos-vibehack](https://github.com/OmkarK97/webos-vibehack) | Frontend starting point, with its MIT notice preserved; the original design comes from tv-vibehack below |
| [Gathin23/tv-vibehack](https://github.com/Gathin23/tv-vibehack) | Original design, layout, and app icon credited by webos-vibehack |
| [angelcode1/webos-HomeBack](https://github.com/angelcode1/webos-HomeBack) | Home-button IPC protocol and native build reference; its build scripts are not copied into this repository |
| [sundermann/inputhookpp](https://github.com/sundermann/inputhookpp) | External native input hook, GPL-3.0 |
| [smx-smx/ezinject](https://github.com/smx-smx/ezinject) | External native injection tool, governed by its own COPYING license |
| [nthnclrk/CleanFrame](https://github.com/nthnclrk/CleanFrame) | Device-and-app layout inspiration and a source for some wallpaper and icon assets; no CleanFrame runtime code is imported |
| [simple-icons/simple-icons](https://github.com/simple-icons/simple-icons) | Brand icons, CC0; trademarks remain with their owners |
| [tabler/tabler-icons](https://github.com/tabler/tabler-icons) | Line icons, MIT |
| [Outfitio/Outfit-Fonts](https://github.com/Outfitio/Outfit-Fonts) | Outfit font, SIL OFL 1.1 |
| [throwaway96/slopbro](https://github.com/throwaway96/slopbro) | Tool used to root the tested TV; root procedures are outside this repository |
| [webosbrew/webos-homebrew-channel](https://github.com/webosbrew/webos-homebrew-channel) | Independent TV installation and root-service permission tool |
| [webosbrew/youtube-webos](https://github.com/webosbrew/youtube-webos) | Separately installed YouTube AdFree app, opened by the launcher |
| [ichikanya/Alcyone](https://github.com/ichikanya/Alcyone) | Separately installed VPN; the launcher exposes an entry point and connection status, with no subscription or node credentials |

[Gathin23/cleanyourtv](https://github.com/Gathin23/cleanyourtv) was an initial discovery reference. Home integration research also included [Simon34545/lginputhook](https://github.com/Simon34545/lginputhook) and [zzeppieri/webos-custom-home](https://github.com/zzeppieri/webos-custom-home). Neither is the native dependency installed by the current implementation. Dynamic tiles were also inspired by Jakub Kralka's [layout demonstration](https://x.com/jakubkralka/status/2112548525577785621) and [motion demonstration](https://x.com/jakubkralka/status/2112629158547423480).

Pinned native versions and build checksums are recorded in [native dependencies](docs/native.md). Photographer credits and asset licenses are recorded in [asset sources](app/ASSETS.md).

## Content sources

| Tile | Current source |
|---|---|
| Bilibili | [Public popular videos](https://www.bilibili.com/v/popular/all), without personal recommendations |
| YouTube | Public RSS from [NASA's official channel](https://www.youtube.com/@NASA) |
| Netflix | [Netflix Tudum Top 10](https://www.netflix.com/tudum/top10) weekly English-language TV list, with cover artwork from [TVmaze](https://www.tvmaze.com/api) |
| Apple TV | [Apple TV Press](https://www.apple.com/tv-pr/originals/) public originals catalog |
| Prime Video, Disney+, and HBO Max | Shared [TMDB](https://www.themoviedb.org/) metadata and JustWatch streaming availability, filtered for the US catalog |

TMDB tiles show catalog selections. They do not represent official platform charts, personal watch progress, or dates when a title joined a platform. Prime Video covers have been displayed on the tested TV. Disney+ and HBO Max metadata queries have been verified, but their apps have not been installed for playback acceptance. Content and image rights remain with their owners.

This product uses the TMDB API but is not endorsed or certified by TMDB. Streaming availability data is provided by JustWatch via TMDB.

## License

New code and frontend modifications use the MIT license. Upstream notices remain in [LICENSE](LICENSE) and the [original license](licenses/webos-vibehack-MIT.txt). The Outfit font retains its OFL license in `app/fonts/`. Wallpapers, icons, and native dependencies retain their respective licenses. The repository's MIT license does not replace those licenses.

This project is not affiliated with LG.
