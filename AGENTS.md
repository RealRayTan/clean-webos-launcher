# 项目约束

- 电视配置、密钥、配对凭据和原始证据不得提交。
- TV_HOST 与 TV_SSH_KEY 由环境变量提供，不写入脚本。
- 安装或物理遥控操作必须有用户授权。源码检查不访问电视。
- 原生依赖与前端各自保留上游版本和许可，不将来源不明二进制加入仓库。
- 按改动运行必要检查。物理行为每种验证一次，不重复三次。
- 区分本地测试、在线状态与物理验收。没有实际确认的行为不得写成已经通过。
- 技术文档使用 pstack technical-writing。

## 电视端调试与防坑规范（基于 webos-tv-kit）

- **严禁使用 `com.webos.service.capture/executeOneShot` 截图**：
  LG OLED 电视在底层硬件上有严格的 HDCP/DRM 版权保护机制。任何调用系统底层截屏服务的操作都会触发硬件安全策略，导致 `MAIN sink` 的底层视频硬件图层直接被锁死置黑（`muted: true, connected: false`），表现为只有弹幕或 UI，视频区域纯黑且无法恢复。
- **强制使用 CDP 截屏与页面检查**：
  使用 `vendor/webos-tv-kit/scripts/cdp_screenshot.py`（基于 Chromium 9998 端口的 `Page.captureScreenshot`）或 CDP 协议进行界面查看与调试，仅在 Web 渲染层取图，绝不触发 DRM 硬件锁。
- **Luna 总线调用方式**：
  SSH 下直接执行 `luna-send` 可能会被系统 Hub ACL 静默过滤无输出。涉及系统总线调用时，使用交互模式（`-i` / 伪终端 `-tt`），或参考 `webos-tv-kit` 的 `tv_luna.py`（端口 23）调用。
- **防止屏保覆盖播放**：
  第三方 Web 视频播放器不会自动重置系统闲置定时器。涉及播放状态保护时，参考 `webos-platform.js` 订阅 `luna://com.webos.service.tvpower/power/registerScreenSaverRequest` 并回复 `ack: false`，绝不可修改全局 `screenSaverTimer`（必须保留原厂 3 分钟 OLED 防烧屏保护）。
- **物理输入源保护**：
  系统 `lastInputApp` 和 `physicalLastInputApp` 只能设置为物理 HDMI 接口（如 `com.webos.app.hdmi4`），严禁设置为非法的应用 ID 或 `com.webos.app.livetv`，避免广播进程常驻抢占硬件多媒体通道。
