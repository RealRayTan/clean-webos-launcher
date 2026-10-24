# LG webOS 海报列表中文桌面

**简体中文** | [English](README.en.md)

为已 root 的 LG webOS 电视提供海报列表中文桌面。桌面以 bind mount 挂成系统 Home，应用退出、短按 Home 和开机都会直接回到它，不再先闪一下 LG 原厂首页；待机唤醒后恢复上次使用的桌面或 HDMI 输入源。桌面跑在电视上，不需要电脑常开。

前端起点是 [webos-vibehack](https://github.com/OmkarK97/webos-vibehack)，本项目增加中文字体回退、电视端按键助手、海报列表首页、系统 Home 挂载、系统屏保替换和共享桌面状态。当前源码与实机版本为 **1.5.8**。

## 安装

电视需要先完成 root，并装好 Homebrew Channel 和密钥 SSH 登录。本仓库不提供 root 工具，也不附带第三方二进制。按[安装与部署指南](docs/install.md)同步应用、准备原生依赖、打包安装，停用方法在同一页。

已 root 的电视使用 **root SSH 的 22 端口** 安装，不走 webOS Developer Mode 的 9922 端口。安装脚本会把桌面挂成系统 Home、把独立屏保页挂成系统屏保，并把桌面状态同步给 Home 副本；短按 Home 或从应用退出都会直接回到桌面。

需要暂时恢复 LG 原厂 Home 和原厂屏保时使用 `tools/desktop_mode.py off`，再执行 `on` 恢复。只恢复原厂屏保可使用 `tools/screensaver_mode.py off`。停用只移除挂载和启动钩子，不卸载应用，也不影响 root。系统性能分析与瘦身可使用 `tools/profile.py` 与 `tools/debloat.py`。

## 界面

| LG 原厂首页 | 项目中文桌面 | 系统屏保 |
|---|---|---|
| [![LG 原厂首页，包含推荐横幅和内容列表](docs/images/lg-home.png)](docs/images/lg-home.png) | [![冷岩浅色系统 Home 桌面，左侧应用列表和 Apple TV 聚焦封面](docs/images/poster-home-1.5.3.png)](docs/images/poster-home-1.5.3.png) | [![纯黑背景上的浮动时钟屏保](docs/images/screensaver-1.5.3.png)](docs/images/screensaver-1.5.3.png) |

左侧是常用输入源和常用应用的竖排列表。聚焦应用后，右侧显示该应用的动态封面：

- 横向封面全屏铺开，竖向封面在右侧以约 80% 高度显示，背景使用深色静态暗化层，杜绝实时高斯模糊卡顿。
- 封面切换使用两个图层交叉淡入，不横向滑动，也不会在快速切换时堆叠图层。
- 右下角显示当前内容的标题和一行描述，中文优先。
- 左下角三横线菜单包含全部应用、输入源、清理内存、网络连接和设置。
- 右上角包含“探索”热门影视大厅入口、本地实时天气与日落提示、主题切换和时钟。按向右键直达探索大厅。
- 主题支持自动、深色、浅色、OLED 纯黑。浅色下时钟和标题信息区使用半透明纸面。
- 背景可选山谷、雾峰或纯色。主题在 07:00 和 19:00 之间按电视本地时间切换，也可以在设置里固定。

设置分为**外观**、**桌面**、**系统**三组：外观管理主题、背景、OLED 纯黑和输入源标签，桌面管理首页应用和内容来源，系统打开 LG 设置。主题、背景、首页应用、顺序和 HDMI 标签保存在电视本地；普通应用和系统 Home 副本通过电视端状态文件共享同一份配置。

输入源标签可以为 HDMI 1–4 选择默认、电脑、PS5、PS4、Xbox、Switch 或媒体中心，首页的电脑入口会同步显示对应名称和色标。主题增加 **OLED 纯黑**。

屏保不再使用 launcher 内覆盖层，而是像系统 Home 一样 bind mount 替换 LG 的 `com.webos.app.screensaver`：电视空闲 3 分钟后由系统启动纯黑浮动时钟，约每 25 秒轻微位移，任意按键退出。这样系统屏保不会再盖住自定义屏保。

应用内短按返回保持原行为。返回键被第三方应用消费、无法退出时，**长按返回约 0.7 秒**会回到桌面，不破坏应用内短按导航。

截图只展示排版，系统 Home、冷岩浅色、屏保、按键接管和待机恢复的实机结果见[验证记录](docs/verification.md)。

## 按键与待机行为

| 操作 | 结果 |
|---|---|
| 短按遥控器 Home 键 | 打开系统 Home 版自定义桌面 |
| 长按 Home 键 | 使用系统 Home 的默认长按路径；启用期间 LG 原厂 Home 被挂载遮蔽，不再直接出现 |
| 在新桌面关机后开机（待机唤醒） | 自动恢复新桌面 |
| 在 HDMI 输入下关机后开机 | 由 LG 原厂系统保留最近输入源 |
| 从新桌面启动应用后退出 | 直接回到自定义桌面，不再经过 LG 原厂首页 |
| 应用内返回键无法退出时 | 长按返回约 0.7 秒回到自定义桌面 |
| 应用内短按返回 | 保持应用自己的返回导航 |
| 菜单选择“清理内存” | 释放 Linux 内核 PageCache 缓存与内存碎片整理，Toast 显示释放前后可用内存 |
| 电视闲置 5 分钟（在桌面或屏保下） | 守护程序自动静默清理内核内存缓存；观影或 HDMI 模式下自动避让 |
| 禁用桌面（`desktop_mode.py off`） | 卸载系统 Home 和屏保挂载，恢复 LG 原厂 Home 与屏保 |
| 只禁用屏保（`screensaver_mode.py off`） | 卸载屏保替换，恢复 LG 原厂屏保 |

哔哩哔哩自带“是否退出应用”确认框；确认退出后直接回到自定义桌面。YouTube AdFree 与 Alcyone 顶层会消费短按返回，因此不强制退出应用；需要离开时使用长按返回或 Home。退出 Alcyone 界面不会断开后台 VPN 连接。

## 管理桌面应用

1. 增减应用：从菜单进入“全部应用”，选择“编辑桌面”，勾选或取消首页应用。隐藏只影响首页，全部应用列表保持完整。
2. 调整顺序：在“编辑桌面”中选择“调整首页顺序”，方向键移动，确认保存，返回取消。
3. 刷新列表：装完新应用重开桌面即可，也可以在全部应用面板里手动刷新。

## 适用范围与已知限制

实机测试环境为 LG OLED42C5XCA，运行 webOS SDK 11.2.0，固件版本 43.21.73。

系统内核是 aarch64，但按键拦截进程和用户空间依赖都跑在 ARM32 下，不能按内核架构选 aarch64 原生模块。

已知限制：

- 系统 Home 通过 bind mount 覆盖 LG 原厂 Home，不写入系统分区；启用期间 LG 原厂 Home 不可直接访问，使用 `tools/desktop_mode.py off` 恢复。
- 系统屏保同样通过 bind mount 覆盖 LG 原厂屏保，不写入系统分区；使用 `tools/screensaver_mode.py off` 可单独恢复原厂屏保。
- 长按返回固定在约 0.7 秒触发；短按返回仍完全交给第三方应用。
- 电视端按键助手没有崩溃后自动重启的守护进程。
- 第三方流媒体应用内的播放进度不在恢复范围内。
- 待机唤醒已有实机记录，完整冷启动还没有。
- 应用图形层上限是 1920×1080，4K 电视会放大整个界面。横向全幅封面在 4K 上会比竖版卡片柔一些；YouTube 公开缩略图最高只有 1280×720。
- 封面来自公开来源，升级后如果仍看到旧的低清图，可在“设置 → 内容来源 → 刷新公开内容”强制更新；竖版卡片和全幅封面使用不同尺寸的源图。

## 动态封面数据源

封面由电视端异步拉取公开数据生成，不读取个人账号或观看历史。服务端每 5 分钟检查一次，公开来源缓存 15 分钟，TMDB 片库缓存 30 分钟；桌面每 60 秒读取一次，手动“刷新公开内容”仍然保留。

| 封面应用 | 数据源 | 说明 |
|---|---|---|
| 哔哩哔哩 | [B站公开热门榜](https://www.bilibili.com/v/popular/all) | 公开榜单，无个性化推荐 |
| YouTube | [NASA 官方频道](https://www.youtube.com/@NASA) 公开 RSS | 公开视频更新与封面，最高 1280×720 |
| Netflix | [Netflix Tudum Top 10](https://www.netflix.com/tudum/top10) | 英语剧集周榜，封面优先 [TVmaze](https://www.tvmaze.com/api) 原图 |
| Apple TV | [Apple TV Press](https://www.apple.com/tv-pr/originals/) + TMDB | 优先 TMDB 原图；没有匹配时回退 Apple 官方 `video_show_home_large_2x` 1960×1104 / `large_2x` |
| Prime Video / Disney+ / HBO Max | [TMDB API](https://www.themoviedb.org/) + JustWatch | 美国区平台公开片库精选，优先 `original` 尺寸 |

TMDB 封面展示的是平台片库公开精选，不是官方榜单或个人观看进度。Prime Video 封面已在实机显示；Disney+ 与 HBO Max 只验证了数据查询，没有做播放验收。影视素材与商标归各自权利人所有。TMDB 配置见[流媒体动态片库设置](docs/streaming-catalog.md)。

电视需要能访问这些公开源。受限网络下，YouTube RSS、Netflix Tudum 和 TMDB 会刷新失败并保留上次封面；B 站和 Apple TV 通常仍可更新。1.5.3 会读取 Alcyone 的本地 loopback SOCKS 端口，只对 YouTube、Netflix、TMDB 走代理，B 站和 Apple TV 继续直连；代理由电视上的 Alcyone 提供，服务不读取或保存其节点凭据。VPN 未连接或代理不可用时，失败仍保留缓存。设置里的“内容来源”会显示状态。

> This product uses the TMDB API but is not endorsed or certified by TMDB. Streaming availability data is provided by JustWatch via TMDB.

## 本地开发与检查

本地检查需要 Node.js 22 和 Python 3.12，不连接电视：

```sh
node --test tests/*.cjs
python3 -m compileall -q tools scripts
bash -n scripts/build.sh service/autostart.sh service/as-home.sh service/screensaver-as-system.sh
```

`app/apps.example.js` 只是占位示例。首次部署前用 `tools/sync-apps.py` 从电视同步真实清单和图标，不要把示例当成设备上的应用列表。左侧“电脑”入口由 `app/config.js` 的 `computerInput` 指定，例如 `com.webos.app.hdmi4`。

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
