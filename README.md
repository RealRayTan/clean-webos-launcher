# LG webOS 中文桌面

**简体中文** | [English](README.en.md)

为已 root 的 LG webOS 电视提供磁贴布局中文桌面。接管遥控器 Home 键，并在待机唤醒后恢复上次使用的桌面或 HDMI 输入源。无需电脑常开。

本项目基于 [webos-vibehack](https://github.com/OmkarK97/webos-vibehack) 构建，补充了中文字体回退、电视端按键助手与界面恢复能力。当前源码与实机测试版本为 **1.3.0**。

## 桌面效果与原厂首页对比

以下实机截图均采集自同一台 LG C5（2026-10-21 原厂首页，2026-10-22 1.3.0 中文桌面）。点击图片可查看原始尺寸。

| LG 原厂首页 | 项目中文桌面 (1.3.0) |
|---|---|
| [![LG 原厂首页，包含推荐横幅和内容列表](docs/images/lg-home.png)](docs/images/lg-home.png) | [![1.3.0 中文桌面，包含动态影视封面](docs/images/tile-home-1.3.0.png)](docs/images/tile-home-1.3.0.png) |

### 界面特性

- **布局结构**：左侧提供常用 HDMI 快捷入口；右侧以双行连续磁贴排列常用应用，超出首屏后横向平滑滚动；底部常驻全部应用、输入源、VPN 与系统设置入口。
- **色彩与图标**：自动提取应用图标主色并生成深浅两套配色；单色图标优先使用应用声明色彩，提取失败时采用中性配色。设置中提供山谷、雾峰与纯色背景选项。
- **自动主题**：基于电视本地时间切换（07:00 至 19:00 为浅色，其余时间为深色），支持在设置中手动固定。
- **中文与保护**：系统采用 UTF-8 编码，包含 LG 中文字体回退；日期、问候语与交互菜单完整中文化；桌面静置 3 分钟后自动降低亮度，不影响电视自带的 OLED 防烧屏机制。

截图仅展示界面排版，按键拦截无闪回与待机恢复的实机验证范围请参阅 [验证记录](docs/verification.md)。

## 按键与状态恢复行为

| 操作 | 结果 |
|---|---|
| 短按遥控器 Home 键 | 打开新桌面 |
| 长按 Home 键约 1 秒后松开 | 打开 LG 原厂首页 |
| 在新桌面关机后开机（待机唤醒） | 自动恢复新桌面 |
| 在 HDMI 输入下关机后开机 | 由 LG 原厂系统保留最近输入源 |
| 从新桌面启动应用后退出 | 返回新桌面（实机验证应用：哔哩哔哩） |
| 从 LG 原厂首页启动应用后退出 | 保持原厂返回行为 |
| 停用桌面服务 | 移除自定义启动脚本与按键租约，保留 root 权限与已装应用 |

第三方应用内的返回键行为由各应用自行决定。实测 YouTube AdFree 与 Alcyone 顶层无退出确认对话框，可短按 Home 键直接返回桌面。退出 Alcyone 界面不会断开后台 VPN 连接。

## 管理桌面应用

在电视上无需修改代码即可管理首页应用：

1. **增减应用**：选中右上角“编辑桌面”按确认键，即可勾选或取消首页磁贴。隐藏操作仅从首页移除展示，不卸载应用；底部“全部应用”始终保留完整应用列表。
2. **调整顺序**：长按首页磁贴上的确认键约 0.6 秒进入排序模式（或在编辑面板选择“调整首页顺序”），使用方向键移动位置，按确认保存，按返回取消。
3. **刷新列表**：安装新应用后重新打开桌面即可自动加载，也可在应用抽屉中手动刷新。

排序顺序、首页选择、壁纸与主题配置均保存在电视本地存储。首次升级会自动继承旧版配置；读取应用失败时保留本地缓存，保存异常时保留原选择。

## 适用范围与已知限制

- **实机测试环境**：LG OLED42C5XCA，运行 webOS SDK 11.2.0，固件版本 43.21.73。
- **架构注意事项**：系统内核虽然是 aarch64，但按键拦截进程与用户空间依赖均运行在 ARM32 环境下，不能直接选用 aarch64 原生模块。
- **前置环境要求**：电视需提前完成 root，并安装 Homebrew Channel 与配置 SSH 密钥登录。本仓库不提供 root 工具，亦不附带第三方未经验证的二进制。
- **已知限制**：
  - 遥控器 Home 键长按超过 6 秒的行为尚未修正。
  - 电视端按键助手暂无崩溃自动重启守护进程。
  - 第三方流媒体应用内的播放进度不在恢复范围内。
  - 当前状态恢复逻辑已有待机唤醒验收记录，但尚无完整的冷启动实机测试记录。

## 文档索引

- [安装与部署指南](docs/install.md)：应用同步、原生依赖准备、打包安装与停用卸载。
- [按键接管与恢复架构](docs/architecture.md)：模块边界、状态流转与故障恢复机制。
- [原生依赖来源与校验](docs/native.md)：第三方原生组件版本、构建校验值与获取途径。
- [流媒体动态片库设置](docs/streaming-catalog.md)：TMDB API 配置、支持平台与封面映射。
- [实机验证记录](docs/verification.md)：区分实机验证事实与本地自动化测试边界。
- [项目演进记录](docs/project-record.md)：历史问题分析、架构迭代与设计边界。
- [版本变更日志](CHANGELOG.md)。

## 动态封面数据源

磁贴支持通过电视端异步拉取公开源生成动态封面与标题，不读取个人账号或观看历史：

| 磁贴应用 | 数据源 | 说明 |
|---|---|---|
| 哔哩哔哩 | [B站公开热门榜](https://www.bilibili.com/v/popular/all) | 纯公开榜单，无个性化推荐 |
| YouTube | [NASA 官方频道](https://www.youtube.com/@NASA) 公开 RSS | 获取公开视频更新与封面 |
| Netflix | [Netflix Tudum Top 10](https://www.netflix.com/tudum/top10) | 英语剧集周榜，封面由 [TVmaze](https://www.tvmaze.com/api) 提供 |
| Apple TV | [Apple TV Press](https://www.apple.com/tv-pr/originals/) | 官方公开原创片单 |
| Prime Video / Disney+ / HBO Max | [TMDB API](https://www.themoviedb.org/) + JustWatch | 查询美国区平台公开片库精选 |

TMDB 磁贴展示内容为平台片库公开精选，不代表官方播放量榜单、个人观看进度或最新上架变动。Prime Video 已在实机正常呈现封面；Disney+ 与 HBO Max 已通过数据查询验证，尚未安装对应应用进行播放验收。影视素材与商标权利归各自权利人所有。

> This product uses the TMDB API but is not endorsed or certified by TMDB. Streaming availability data is provided by JustWatch via TMDB.

## 本地开发与检查

本地测试环境需要 Node.js 22 与 Python 3.12，无需连接实体电视：

```sh
node --test tests/*.cjs
python3 -m compileall -q tools scripts
bash -n scripts/build.sh service/autostart.sh
```

### 电视配置与示例清单

- 仓库提供的 `app/apps.example.js` 仅包含原厂首页的占位示例。首次部署前需通过脚本从电视端实际同步应用列表与图标，不能将示例清单当作真实设备的应用列表。
- `app/config.js` 中的 `computerInput` 项用于配置桌面左侧的 HDMI 快捷输入端口（如 `com.webos.app.hdmi4`）。

## 上游项目与致谢

下表区分本项目使用的源码、外部依赖、设计灵感与独立运行应用。独立应用与 root 工具不包含在本仓库中：

| 项目 | 在本项目中的定位 |
|---|---|
| [OmkarK97/webos-vibehack](https://github.com/OmkarK97/webos-vibehack) | 前端起点，保留上游 MIT 许可；界面灵感源自 tv-vibehack |
| [Gathin23/tv-vibehack](https://github.com/Gathin23/tv-vibehack) | webos-vibehack 的原始布局与应用图标设计来源 |
| [angelcode1/webos-HomeBack](https://github.com/angelcode1/webos-HomeBack) | Home 键接管 IPC 协议与构建参考，构建脚本未直接复制 |
| [sundermann/inputhookpp](https://github.com/sundermann/inputhookpp) | 原生输入事件钩子，采用独立 GPL-3.0 许可 |
| [smx-smx/ezinject](https://github.com/smx-smx/ezinject) | 原生进程注入工具，采用自身 COPYING 许可 |
| [nthnclrk/CleanFrame](https://github.com/nthnclrk/CleanFrame) | 设备与应用分区布局参考，部分壁纸与图标来源；未引入其代码 |
| [simple-icons/simple-icons](https://github.com/simple-icons/simple-icons) | 品牌图标库，CC0 许可；商标权利归各品牌方所有 |
| [tabler/tabler-icons](https://github.com/tabler/tabler-icons) | 功能线条图标，MIT 许可 |
| [Outfitio/Outfit-Fonts](https://github.com/Outfitio/Outfit-Fonts) | 英文字体 Outfit，SIL OFL 1.1 许可 |
| [throwaway96/slopbro](https://github.com/throwaway96/slopbro) | 实机获取 root 权限时使用的工具；本仓库不含 root 流程 |
| [webosbrew/webos-homebrew-channel](https://github.com/webosbrew/webos-homebrew-channel) | 电视端安装管理与 root 权限服务组件 |
| [webosbrew/youtube-webos](https://github.com/webosbrew/youtube-webos) | 独立安装的 YouTube AdFree，桌面提供快捷启动入口 |
| [ichikanya/Alcyone](https://github.com/ichikanya/Alcyone) | 独立安装的 VPN 应用；桌面展示连接状态与快捷入口 |

前期调研项目包括 [Gathin23/cleanyourtv](https://github.com/Gathin23/cleanyourtv)。按键接管方案调研过 [Simon34545/lginputhook](https://github.com/Simon34545/lginputhook) 与 [zzeppieri/webos-custom-home](https://github.com/zzeppieri/webos-custom-home)，两者未作为当前原生依赖。动态磁贴设计参考了 [Jakub Kralka 的布局展示](https://x.com/jakubkralka/status/2112548525577785621) 与 [动效演示](https://x.com/jakubkralka/status/2112629158547423480)。

原生模块版本与校验值记录于 [原生依赖来源](docs/native.md)，摄影素材许可与作者署名记录于 [素材记录](app/ASSETS.md)。

## 开源许可

本项目新增代码与前端改造采用 MIT 许可。保留的上游版权声明见 [LICENSE](LICENSE) 与 [原始许可文件](licenses/webos-vibehack-MIT.txt)。`app/fonts/` 下的 Outfit 字体遵循 SIL OFL 1.1 许可。

原生组件 `inputhookpp` 与 `ezinject` 为独立外部依赖，遵循各自开源许可，不能统称为 MIT；版本和许可见 [原生依赖来源](docs/native.md)。本项目与 LG 官方无关，亦不保证 root 行为可无损还原或不影响设备保修。
