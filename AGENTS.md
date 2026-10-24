# 项目约束与开发规范

## 安全与验证边界

- 电视配置、密钥、配对凭据和原始证据不得提交。
- 连接目标优先读取环境变量 `TV_HOST` 与 `TV_SSH_KEY`；未设置时统一回退读取本地 `~/.ssh/config` 中的 `lgtv` 别名免密连接。连接地址与私钥不写入脚本或提交至仓库。
- 安装或物理遥控操作必须有用户授权。源码检查与单元测试不访问电视。
- 原生依赖与前端各自保留上游版本和许可，不将来源不明二进制加入仓库。
- 区分本地测试、在线状态与物理验收。没有实际确认的行为不得写成已经通过。物理行为每种验证一次，不重复三次。
- 技术文档使用 pstack `technical-writing`。

## 电视端底层与硬件保护（基于 webos-tv-kit）

- **严禁使用 `com.webos.service.capture/executeOneShot` 截图**：
  LG OLED 电视在底层硬件上有严格的 HDCP/DRM 保护机制。调用系统底层截屏服务会触发硬件安全策略，导致 `MAIN sink` 的视频硬件图层直接锁死置黑（`muted: true, connected: false`），表现为只有 UI 而视频区域纯黑且无法恢复。
- **强制使用 CDP 截屏与页面检查**：
  使用 `vendor/webos-tv-kit/scripts/cdp_screenshot.py`（基于 Chromium 9998 端口的 `Page.captureScreenshot`）或 CDP 协议进行界面查看与调试，仅在 Web 渲染层取图，不触发 DRM 硬件锁。
- **Luna 总线调用方式**：
  SSH 下直接执行 `luna-send` 易被系统 Hub ACL 静默过滤无输出。涉及系统总线调用时，使用交互模式（`-i` / 伪终端 `-tt`），或参考 `webos-tv-kit` 的 `tv_luna.py`（端口 23）调用。
- **物理输入源保护**：
  系统 `lastInputApp` 和 `physicalLastInputApp` 只能设置为物理 HDMI 接口（如 `com.webos.app.hdmi4`），严禁设置为非法的应用 ID 或 `com.webos.app.livetv`，避免广播进程常驻抢占硬件多媒体通道。
- **防止屏保覆盖播放**：
  第三方 Web 视频播放器不会自动重置系统闲置定时器。涉及播放状态保护时，订阅 `luna://com.webos.service.tvpower/power/registerScreenSaverRequest` 并回复 `ack: false`，绝不可修改全局 `screenSaverTimer`（必须保留原厂 3 分钟 OLED 防烧屏保护）。

## 前端渲染与动效规范（低功耗电视优化）

- **禁止脚本注入几何内联样式**：
  卡片与列表焦点状态必须由 CSS 样式表单一事实来源驱动。严禁使用 JavaScript（如 GSAP）向 DOM 节点写入内联 `transform`、`scale` 或 `box-shadow`，避免样式污染和切项后海报失真残留。
- **有界显存池与串行预加载**：
  图片加载统一接入 `app/pool.js`。主页封面常驻上限为 8，探索大厅上限为 10；多图预加载必须使用 `PreloadQueue` 单任务步进解码，遥控器操作期间自动挂起，淡出完成后显式解绑非视口大图。
- **严禁 1080p 实时高斯模糊**：
  全屏与大尺寸卡片严禁使用 `filter: blur()`、`backdrop-filter: blur()` 或大半径动态软阴影，避免击穿电视 GPU 显存带宽与离屏混合缓冲区。
- **轨道滑动必须交由合成器线程**：
  横向或纵向货架平移统一采用 CSS `transition: transform` 与 `translate3d` 硬件加速，避免在 JS 主线程运行逐帧插值循环。
