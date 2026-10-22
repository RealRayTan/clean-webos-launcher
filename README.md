# LG webOS 中文桌面

**简体中文** | [English](README.en.md)

为已 root 的 LG webOS 电视提供磁贴布局中文桌面。接管遥控器 Home 键，并在待机唤醒后恢复上次使用的桌面或 HDMI 输入源。桌面跑在电视上，不需要电脑常开。

前端起点是 [webos-vibehack](https://github.com/OmkarK97/webos-vibehack)，本项目增加中文字体回退、电视端按键助手和界面恢复。当前源码与实机版本为 1.3.0。

## 安装

电视需要先完成 root，并装好 Homebrew Channel 和密钥 SSH 登录。本仓库不提供 root 工具，也不附带第三方二进制。按[安装与部署指南](docs/install.md)同步应用、准备原生依赖、打包安装，停用方法在同一页。

## 界面

| LG 原厂首页 | 项目中文桌面 |
|---|---|
| [![LG 原厂首页，包含推荐横幅和内容列表](docs/images/lg-home.png)](docs/images/lg-home.png) | [![中文桌面，包含动态影视封面](docs/images/tile-home-1.3.0.png)](docs/images/tile-home-1.3.0.png) |

左侧放常用 HDMI 入口，右侧两行应用磁贴，超出首屏后横向滚动。底部固定放全部应用、输入源、VPN 和设置。

磁贴底色取自应用图标主色，读不到颜色时用中性色。背景可选山谷、雾峰或纯色。主题在 07:00 和 19:00 之间按电视本地时间切换，也可以在设置里固定。界面闲置三分钟后降低亮度，不改动电视自带的 OLED 保护设置。

截图只展示排版，按键接管和待机恢复的实机结果见[验证记录](docs/verification.md)。

## 按键与待机行为

| 操作 | 结果 |
|---|---|
| 短按遥控器 Home 键 | 打开新桌面 |
| 长按 Home 键约 1 秒后松开 | 打开 LG 原厂首页 |
| 在新桌面关机后开机（待机唤醒） | 自动恢复新桌面 |
| 在 HDMI 输入下关机后开机 | 由 LG 原厂系统保留最近输入源 |
| 从新桌面启动应用后退出 | 返回新桌面（实机验证应用：哔哩哔哩） |
| 从 LG 原厂首页启动应用后退出 | 保持原厂返回行为 |

第三方应用内的返回键行为由各应用自行决定。实测 YouTube AdFree 与 Alcyone 顶层没有退出确认对话框，可以短按 Home 返回桌面。退出 Alcyone 界面不会断开后台 VPN 连接。

## 管理桌面应用

1. 增减应用：选中右上角“编辑桌面”按确认键，勾选或取消首页磁贴。隐藏只影响首页，底部“全部应用”保留完整列表。
2. 调整顺序：长按磁贴上的确认键约 0.6 秒进入排序模式，也可以用编辑面板的“调整首页顺序”，方向键移动，确认保存，返回取消。
3. 刷新列表：装完新应用重开桌面即可，也可以在应用抽屉里手动刷新。

顺序、首页选择、壁纸和主题保存在电视本地，升级会自动继承旧配置。

## 适用范围与已知限制

实机测试环境为 LG OLED42C5XCA，运行 webOS SDK 11.2.0，固件版本 43.21.73。

系统内核是 aarch64，但按键拦截进程和用户空间依赖都跑在 ARM32 下，不能按内核架构选 aarch64 原生模块。

已知限制：

- 遥控器 Home 键长按超过 6 秒的行为未修正。
- 电视端按键助手没有崩溃后自动重启的守护进程。
- 第三方流媒体应用内的播放进度不在恢复范围内。
- 待机唤醒已有实机记录，完整冷启动还没有。

## 动态封面数据源

磁贴由电视端异步拉取公开数据生成封面和标题，不读取个人账号或观看历史。

| 磁贴应用 | 数据源 | 说明 |
|---|---|---|
| 哔哩哔哩 | [B站公开热门榜](https://www.bilibili.com/v/popular/all) | 公开榜单，无个性化推荐 |
| YouTube | [NASA 官方频道](https://www.youtube.com/@NASA) 公开 RSS | 公开视频更新与封面 |
| Netflix | [Netflix Tudum Top 10](https://www.netflix.com/tudum/top10) | 英语剧集周榜，封面由 [TVmaze](https://www.tvmaze.com/api) 提供 |
| Apple TV | [Apple TV Press](https://www.apple.com/tv-pr/originals/) | 官方公开原创片单 |
| Prime Video / Disney+ / HBO Max | [TMDB API](https://www.themoviedb.org/) + JustWatch | 美国区平台公开片库精选 |

TMDB 磁贴展示的是平台片库公开精选，不是官方榜单或个人观看进度。Prime Video 封面已在实机显示；Disney+ 与 HBO Max 只验证了数据查询，没有做播放验收。影视素材与商标归各自权利人所有。TMDB 配置见[流媒体动态片库设置](docs/streaming-catalog.md)。

> This product uses the TMDB API but is not endorsed or certified by TMDB. Streaming availability data is provided by JustWatch via TMDB.

## 本地开发与检查

本地检查需要 Node.js 22 和 Python 3.12，不连接电视：

```sh
node --test tests/*.cjs
python3 -m compileall -q tools scripts
bash -n scripts/build.sh service/autostart.sh
```

`app/apps.example.js` 只是占位示例。首次部署前用 `tools/sync-apps.py` 从电视同步真实清单和图标，不要把示例当成设备上的应用列表。左侧 HDMI 入口由 `app/config.js` 的 `computerInput` 指定，例如 `com.webos.app.hdmi4`。

## 文档

- [安装与部署](docs/install.md)
- [按键接管与恢复架构](docs/architecture.md)
- [原生依赖来源与校验](docs/native.md)
- [流媒体动态片库设置](docs/streaming-catalog.md)
- [实机验证记录](docs/verification.md)
- [项目演进记录](docs/project-record.md)
- [版本变更日志](CHANGELOG.md)

## 上游与许可

前端起点是 webos-vibehack，原生依赖是 inputhookpp 与 ezinject，其余项目是设计参考或独立安装的应用。完整清单、许可和素材署名见[上游与致谢](docs/credits.md)。

新增代码与前端改造采用 MIT 许可，上游版权声明保留在 [LICENSE](LICENSE) 和[原始许可文件](licenses/webos-vibehack-MIT.txt)。`app/fonts/` 下的 Outfit 字体遵循 SIL OFL 1.1；`inputhookpp` 与 `ezinject` 按各自的许可发布，不在 MIT 范围内。本项目与 LG 官方无关，root 可能影响保修，也不能保证无损还原。
