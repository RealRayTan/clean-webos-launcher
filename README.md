# LG webOS 极简海报中文桌面

> 为已 root 的 LG webOS 电视打造的沉浸式海报桌面。彻底告别原厂广告与卡顿，满血释放 OLED 画质潜力与系统可用内存。

**简体中文** | [English](README.en.md)

当前实机与源码版本：**v1.5.9**。适用平台：LG webOS 24 与 webOS 25（实测验证机型：LG OLED42C5XCA）。

---

## 为什么替换原厂首页？

LG 原厂 webOS 首页存在开机商业广告、滚动推荐横幅与后台遥测。应用退出时也经常出现原厂首页闪回与卡顿。

本项目通过底层非侵入式挂载，将电视首页彻底替换为轻盈纯净的海报流桌面。桌面直接运行在电视端 Linux 系统上，不需要外部电视盒子，也不需要电脑常开。

| 体验维度 | LG 原厂 webOS 首页 | 本项目海报桌面 (v1.5.9) |
|---|---|---|
| **启动速度** | 强制等待网络推广与商业卡片加载 | 秒级直达，无任何商业广告插播 |
| **应用退出** | 退回原厂主页并伴随界面重绘 | 退出后直接回到桌面，保持原会话现场 |
| **可用物理内存** | 开机后通常仅剩约 450 MB | **测定稳定在 750 至 800 MB**（提升约 80%） |
| **OLED 视觉** | 杂乱高亮度色块与全屏浅色底色 | Pure OLED 纯黑底色，像素级完全关闭 |
| **防烧屏保护** | 原厂时钟时常被应用内覆盖层遮挡 | 独立系统级屏保，25 秒浮动位移防烧屏 |
| **多设备联动** | 关机容易丢失电脑或游戏机输入源 | 待机唤醒自动恢复 HDMI 输入与设备标签 |
| **固件安全性** | 传统硬改需修改只读系统分区 | **只读 Bind Mount**，不写系统分区，一键完整还原 |

---

## 核心特性

### 1. 系统级无感替代 (True System Home)
- **真原生挂载**：直接覆盖 `com.webos.app.home`。短按 Home、应用退出和开机均直接进入，无原厂首页闪烁。
- **持久化闪存存储**：挂载暂存目录迁移至闪存持久化路径，彻底消除桌面静态资源对系统 tmpfs 内存盘的挤占。
- **安全逃生门**：第三方应用（如哔哩哔哩、YouTube）内短按返回完全交由应用内处理；长按返回约 0.7 秒可强行拉回桌面，彻底消除切源黑屏死锁。

### 2. 沉浸式海报流与影视雷达 (Cinema Posters)
- **多平台动态海报**：实时拉取哔哩哔哩热门、YouTube NASA、Netflix 周榜、Apple TV 精选与 TMDB（Prime Video / Disney+ / Max）公开片库封面。
- **平滑轮播机制**：光标停留在多作品应用时每 10 秒自动交叉淡入切换下一部作品，标题与简介同步联动。
- **探索大厅 (Trending Radar)**：顶栏一键直达全屏探索大厅，提供电影与剧集周榜精选、原名、年代、TMDB 评分与剧情简介。
- **网络自愈与代理直通**：自动读取电视端 Alcyone 本地 SOCKS5 端口，针对受限海报域名独立走代理，国内公开源直连，失败自动保留缓存。

### 3. 低功耗电视前端管线 (60 FPS Engine)
- **有界 LRU 显存池 (`app/pool.js`)**：主页海报常驻上限 8 张，探索大厅上限 10 张。超出容量主动解除 GPU 纹理引用，杜绝显存泄漏。
- **串行异步解码 (`PreloadQueue`)**：单任务排队执行图像解码，遥控器切项期间自动暂停，静止后恢复，消除密集并发解码卡顿。
- **零实时高斯模糊**：彻底剔除 1080p 实时高斯模糊与卡片软阴影，滑动过渡交由合成器线程硬件加速，满帧 60 FPS 滚动。

### 4. 深度系统减负与内核清理 (Debloat & RAM Manager)
- **后台常驻预载切断**：自动停用 YouTube 与 LG 频道后台静默预加载，阻止其侵占 160MB 以上物理内存。
- **厂商遥测与臃肿服务停用**：安全停用 `service-logger`、`ai-inference-manager`、`alwaysready` 等 8 个无用后台系统守护进程，关闭系统推广开关。
- **内核内存一键与闲置清理**：菜单集成“清理内存”，调用 root 权限释放 Linux 内核 PageCache 缓存；闲置 5 分钟在桌面或屏保下自动静默回收，观影与 HDMI 游戏自动避让。
- **安全红线守则**：严格排除 `sdx`（保障齿轮设置菜单可用）与 `ss.gateway`（保障手机投屏正常）。

### 5. 专为 OLED 定制的美学与屏保 (OLED First)
- **四套主题与动态冷岩**：支持自动、深色、冷岩浅色与 Pure OLED 纯黑。
- **系统屏保深度替换**：覆盖 LG 原厂 `com.webos.app.screensaver`，3 分钟无操作由系统自动拉起纯黑浮动时钟，每 25 秒轻微位移，任意按键退出，保护面板不烧屏。
- **实时天气与日出日落**：本地气象数据驱动，支持根据日出日落时间自动切换深浅主题。

---

## 界面展示

| LG 原厂首页 (臃肿横幅) | 项目中文桌面 (冷岩浅色) | 系统屏保 (纯黑浮动防烧屏) |
|---|---|---|
| [![LG 原厂首页](docs/images/lg-home.png)](docs/images/lg-home.png) | [![中文桌面](docs/images/poster-home-1.5.3.png)](docs/images/poster-home-1.5.3.png) | [![系统屏保](docs/images/screensaver-1.5.3.png)](docs/images/screensaver-1.5.3.png) |

---

## 快速上手

### 前置要求
1. 电视已完成 root，并安装好 **Homebrew Channel**。
2. 开启 Homebrew Channel 设置中的 **SSH 服务**（默认端口 22，建议配置公钥免密登录）。
3. 本机安装有 Python 3.12 与 Node.js 22。

### 安装步骤
1. 配置连接目标（环境变量优先，也支持 `~/.ssh/config` 中的 `Host lgtv` 别名）：
   ```sh
   export TV_HOST='192.168.x.x'
   export TV_SSH_KEY='/path/to/your/key'
   ```
2. 安装本地构建工具并准备原生二进制：
   ```sh
   npm install --global @webos-tools/cli
   python3 -m venv .venv
   .venv/bin/pip install -r requirements.txt
   python3 scripts/prepare_native.py /path/to/native-artifact
   ```
3. 构建安装包并一键推送到电视：
   ```sh
   bash scripts/build.sh
   .venv/bin/python tools/install.py
   ```
安装工具完成后电视无需重启，直接按遥控器 Home 键即可体验。

### 一键恢复与回滚
- **恢复 LG 原厂首页与原厂屏保**：
  ```sh
  .venv/bin/python tools/desktop_mode.py off
  ```
- **重新激活自定义桌面**：
  ```sh
  .venv/bin/python tools/desktop_mode.py on
  ```
- **仅恢复原厂屏保**：
  ```sh
  .venv/bin/python tools/screensaver_mode.py off
  ```

---

## 遥控器与日常交互指南

| 遥控器操作 | 系统响应与动作 |
|---|---|
| **短按 Home 键** | 秒级回到海报桌面 |
| **长按 Home 键** | 触发系统默认长按路径 |
| **应用内短按返回** | 优先响应第三方应用自有返回逻辑 |
| **应用无法退出时** | **长按返回约 0.7 秒**强行退出回到桌面（逃生通道） |
| **关机后待机唤醒** | 关机前若为桌面则恢复桌面；若为 HDMI 则保留原厂输入源 |
| **主菜单按向右键** | 顶栏直接进入“探索热门”全景影视大厅 |
| **菜单选择“清理内存”** | 手动执行 Linux 内核 PageCache 回收与内存碎片紧缩 |

---

## 本地开发与代码检查

本地检查在电脑本地运行，不需要连接电视设备：

```sh
node --test tests/*.cjs
python3 -m compileall -q tools scripts
bash -n scripts/build.sh service/autostart.sh service/as-home.sh service/screensaver-as-system.sh service/optimize.sh
```

---

## 架构与深入文档

- [按键接管与系统恢复原理 (Architecture)](docs/architecture.md)
- [安装与部署详细操作 (Installation Guide)](docs/install.md)
- [原生依赖来源与严格哈希校验 (Native Checksums)](docs/native.md)
- [流媒体动态片库设置 (Streaming Catalog)](docs/streaming-catalog.md)
- [实机验证记录与硬件审计 (Verification Record)](docs/verification.md)
- [项目演进历史与复盘 (Project Evolution)](docs/project-record.md)
- [版本变更日志 (Changelog)](CHANGELOG.md)

---

## 上游与许可

前端起点来自 webos-vibehack，原生依赖为 inputhookpp 与 ezinject，其余项目为设计参考或独立应用。完整清单、许可与素材署名见[上游与致谢](docs/credits.md)。

新增代码与桌面改造采用 MIT 许可，上游版权声明保留在 [LICENSE](LICENSE) 和[原始许可文件](licenses/webos-vibehack-MIT.txt)。`app/fonts/` 下的字体遵循 SIL OFL 1.1；`inputhookpp` 与 `ezinject` 按各自许可发布。本项目与 LG 官方无关，root 属于用户自主行为。
