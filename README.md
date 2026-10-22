# LG webOS 中文桌面

**简体中文** | [English](README.en.md)

为 LG webOS 电视提供磁贴布局的中文桌面，并在已 root 的电视上接管 Home 键、记住关机前的新桌面或 HDMI 输入源。当前源码与实机版本为 **1.3.0**，Prime Video 共用片库已配置并在 LG C5 上运行。

本项目从 [webos-vibehack](https://github.com/OmkarK97/webos-vibehack) 起步，补充中文字体回退、电视端按键助手和界面恢复。不需要电脑常开。

## 当前桌面

![1.3.0 动态磁贴桌面与 Prime Video，LG C5 实机截图](docs/images/tile-home-1.3.0.png)

左侧直达常用 HDMI，右侧以两行连续排列常用应用，超过首屏后横向滚动，不显示页码。底部提供全部应用、输入源、VPN 和设置入口。自动主题按电视本地时间切换：07:00 至 19:00 使用浅色，其余时间使用深色，也可手动固定。设置中可选择山谷、雾峰或纯色背景。

图标自动提取主色，并生成深浅两套柔和配色；单色图标优先使用应用声明色，读取失败则用中性色。设置保留主题、背景和动态开关，来源状态单独展示。B站公开热门、NASA 的 YouTube 频道更新、Netflix 英语剧集周榜和 Apple TV 官方片单由电视端更新，不读取个人账号或观看历史。

Prime Video、Disney+ 和 HBO Max 的共用片库配置见 [影视资料源设置](docs/streaming-catalog.md)。缺少 TMDB 凭据时保留品牌磁贴，不生成片单。

## 原厂首页与当前桌面

以下均为同一台 LG C5 的原始实机截图。原厂首页拍摄于 2026-10-21，新桌面为 2026-10-22 的 1.3.0，包含实际获取的 Prime Video 动态封面。点击图片可查看原尺寸。

| LG 原厂首页 | 项目中文桌面 |
|---|---|
| [![LG 原厂首页，包含推荐横幅和内容列表](docs/images/lg-home.png)](docs/images/lg-home.png) | [![1.3.0 中文桌面，包含动态影视封面](docs/images/tile-home-1.3.0.png)](docs/images/tile-home-1.3.0.png) |

新桌面把时钟、常用应用和输入源入口放在首屏，不显示原厂首页的推荐内容。中文日期、问候语与菜单均来自当前界面。原厂首页仍可通过长按 Home 打开。

静态截图只展示布局。Home 无闪回与界面恢复的验证范围见 [验证记录](docs/verification.md)。

## 当前行为

| 操作 | 结果 |
|---|---|
| 短按实体遥控器 Home | 打开新桌面 |
| 长按 Home 约一秒后松开 | 打开 LG 原厂首页 |
| 在新桌面关机后开机 | 恢复新桌面 |
| 在 HDMI 关机后开机 | 由 LG 系统保留最近输入源 |
| 从新桌面打开应用后退出 | 返回新桌面；当前实机验证为哔哩哔哩 |
| 从 LG 原厂首页打开应用后退出 | 保留原厂返回行为 |
| 停用桌面改造 | 移除自定义启动钩子和按键租约，保留 root 与应用 |

第三方应用内的返回键行为由应用决定。当前实测的 YouTube AdFree 和 Alcyone 在顶层没有退出确认框，可短按 Home 返回新桌面。离开 Alcyone 界面不会断开 VPN。

中文使用 UTF-8，字体回退包含 LG 中文字体。日期、问候语、输入源和设置按钮已中文化。桌面空闲三分钟后降低亮度，不更改电视自身的 OLED 保护设置。

## 适用范围

已有实机记录：LG OLED42C5XCA，webOS SDK 11.2.0，固件 43.21.73。虽然内核是 aarch64，按键进程和用户空间依赖使用 ARM32；不能仅按内核架构选择模块。

本仓库不提供 root 工具或通用机型适配。安装前需要自行完成 root、Homebrew Channel 和密钥 SSH。原生依赖需要单独准备，仓库不附带第三方二进制或 IPK。

当前已知限制：超过六秒的 Home 长按未修正；桌面助手没有崩溃后自动重启监督；第三方视频应用的播放位置不在恢复范围内。新恢复逻辑尚无完整冷启动的实机验收记录。

## 使用文档

- [安装到已 root 的电视](docs/install.md)：同步应用、准备依赖、打包、安装和停用。
- [Home 接管与界面恢复原理](docs/architecture.md)：模块边界、状态和故障处理。
- [原生依赖来源](docs/native.md)：版本、校验值和准备方法。
- [本次改造记录](docs/project-record.md)：问题、迭代、pstack 审查及验证边界。
- [验证记录](docs/verification.md)：实机事实与本地检查分开记录。
- [版本变化](CHANGELOG.md)。

## 管理桌面应用

选择右上方“编辑桌面”，按确认键增减首页应用。新增卡片保持尺寸，左右方向键沿同一行移动，焦点自动滚入视野。隐藏只移除首页磁贴，不卸载应用。底部“全部应用”始终保留完整列表。

长按首页应用上的确认键约 0.6 秒可开始排序，也可在编辑面板选择“调整首页顺序”。上下移动后按确认保存，按返回取消。安装新应用后重新打开桌面会自动刷新，也可在应用面板手动刷新。

排序、首页选择、壁纸和主题保存在电视本地。首次升级会读取旧版的隐藏与排序设置。读取应用列表失败时保留缓存，保存失败时保留原来的选择。

## 本地检查

需要 Node.js 22 和 Python 3.12。下面的检查不连接电视。

```sh
node --test tests/*.cjs
python3 -m compileall -q tools scripts
bash -n scripts/build.sh service/autostart.sh
```

仓库的 `app/apps.example.js` 默认只包含一个 LG 原厂首页示例。应用清单与图标由你在本地同步，不能把示例清单当作电视的实时应用列表。首页应用在电视上的“编辑桌面”中选择；`app/config.js` 的 `computerInput` 指定左侧快捷输入源。

## 上游与致谢

下表区分本项目使用的代码、外部依赖、设计参考和电视上独立安装的应用。独立应用与 root 工具不随本仓库分发。

| 仓库 | 本项目中的用途 |
|---|---|
| [OmkarK97/webos-vibehack](https://github.com/OmkarK97/webos-vibehack) | 前端起点，保留上游 MIT 声明；原始设计源自下列 tv-vibehack |
| [Gathin23/tv-vibehack](https://github.com/Gathin23/tv-vibehack) | webos-vibehack 原始设计、布局与应用图标的来源 |
| [angelcode1/webos-HomeBack](https://github.com/angelcode1/webos-HomeBack) | Home 键 IPC 协议与原生构建参考，构建脚本未复制进本仓库 |
| [sundermann/inputhookpp](https://github.com/sundermann/inputhookpp) | 原生按键钩子，独立 GPL-3.0 依赖 |
| [smx-smx/ezinject](https://github.com/smx-smx/ezinject) | 原生注入工具，独立外部依赖，适用自身 COPYING 许可 |
| [nthnclrk/CleanFrame](https://github.com/nthnclrk/CleanFrame) | 当前设备与应用分区的布局参考，以及部分壁纸和图标素材来源；未引入其运行时代码 |
| [simple-icons/simple-icons](https://github.com/simple-icons/simple-icons) | 品牌图标，CC0；商标权仍归品牌方 |
| [tabler/tabler-icons](https://github.com/tabler/tabler-icons) | 线条图标，MIT |
| [Outfitio/Outfit-Fonts](https://github.com/Outfitio/Outfit-Fonts) | Outfit 字体，SIL OFL 1.1 |
| [throwaway96/slopbro](https://github.com/throwaway96/slopbro) | 本次电视取得 root 使用的工具；本仓库不包含 root 流程 |
| [webosbrew/webos-homebrew-channel](https://github.com/webosbrew/webos-homebrew-channel) | 电视端安装与 root 服务权限所需的独立工具 |
| [webosbrew/youtube-webos](https://github.com/webosbrew/youtube-webos) | 独立安装的 YouTube AdFree，桌面提供启动入口 |
| [ichikanya/Alcyone](https://github.com/ichikanya/Alcyone) | 独立安装的 VPN；桌面仅提供入口与连接状态，不包含订阅或节点 |

调研入口包括 [Gathin23/cleanyourtv](https://github.com/Gathin23/cleanyourtv)。Home 接管方案还调研了 [Simon34545/lginputhook](https://github.com/Simon34545/lginputhook) 和 [zzeppieri/webos-custom-home](https://github.com/zzeppieri/webos-custom-home)，它们不是当前安装的原生依赖。动态磁贴效果参考了 [Jakub Kralka 的布局展示](https://x.com/jakubkralka/status/2112548525577785621)与[动态效果展示](https://x.com/jakubkralka/status/2112629158547423480)。

固定提交与构建校验值见 [原生依赖来源](docs/native.md)，摄影师、素材许可和署名见 [素材记录](app/ASSETS.md)。

## 动态封面的资料来源

| 磁贴 | 当前资料源 |
|---|---|
| 哔哩哔哩 | [B站公开热门](https://www.bilibili.com/v/popular/all)，不读取个人推荐 |
| YouTube | [NASA 官方频道](https://www.youtube.com/@NASA)的公开 RSS |
| Netflix | [Netflix Tudum Top 10](https://www.netflix.com/tudum/top10) 英语剧集周榜，封面通过 [TVmaze](https://www.tvmaze.com/api) 补充 |
| Apple TV | [Apple TV Press](https://www.apple.com/tv-pr/originals/) 官方片单 |
| Prime Video、Disney+、HBO Max | [TMDB](https://www.themoviedb.org/) 共用影视资料与 JustWatch 平台可用性数据，按美国片库筛选 |

TMDB 磁贴展示“片库精选”，不代表平台官方热榜、个人观看进度或平台新上线时间。Prime Video 已在实机展示封面。Disney+ 与 HBO Max 已验证资料查询，尚未安装对应应用做播放验收。图片和影视内容的权利归各自权利人。

This product uses the TMDB API but is not endorsed or certified by TMDB. Streaming availability data is provided by JustWatch via TMDB.

## 来源与许可

本项目的新增代码和前端改造使用 MIT 许可。上游版权声明保留在 [LICENSE](LICENSE) 和 [原始许可](licenses/webos-vibehack-MIT.txt)。Outfit 字体及其 OFL 许可保留在 `app/fonts/`。磁贴布局参考 CleanFrame，素材来源与各自许可见 [素材记录](app/ASSETS.md)。

原生 `inputhookpp` 与 `ezinject` 是独立外部依赖，适用各自许可，不能把它们统称为 MIT；版本和许可见 [原生依赖来源](docs/native.md)。本项目没有 LG 官方关联，也不承诺 root 可无痕撤销或不影响保修。
