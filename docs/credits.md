# 上游项目与依赖

本页列出本项目使用的源码、外部依赖、设计参考与独立安装的应用。root 工具和独立应用不随仓库分发。

| 项目 | 在本项目中的定位 |
|---|---|
| [OmkarK97/webos-vibehack](https://github.com/OmkarK97/webos-vibehack) | 前端起点，保留上游 MIT 许可；界面灵感来自 tv-vibehack |
| [Gathin23/tv-vibehack](https://github.com/Gathin23/tv-vibehack) | webos-vibehack 的原始布局与应用图标来源 |
| [angelcode1/webos-HomeBack](https://github.com/angelcode1/webos-HomeBack) | Home 键接管 IPC 协议与构建参考，构建脚本未直接复制 |
| [sundermann/inputhookpp](https://github.com/sundermann/inputhookpp) | 原生输入事件钩子，GPL-3.0 许可 |
| [smx-smx/ezinject](https://github.com/smx-smx/ezinject) | 原生进程注入工具，遵循自身 COPYING 许可 |
| [nthnclrk/CleanFrame](https://github.com/nthnclrk/CleanFrame) | 设备与应用分区布局参考，部分壁纸与图标来源；未引入其代码 |
| [simple-icons/simple-icons](https://github.com/simple-icons/simple-icons) | 品牌图标库，CC0 许可；商标权利归各品牌方所有 |
| [tabler/tabler-icons](https://github.com/tabler/tabler-icons) | 功能线条图标，MIT 许可 |
| [Outfitio/Outfit-Fonts](https://github.com/Outfitio/Outfit-Fonts) | 英文字体 Outfit，SIL OFL 1.1 许可 |
| [throwaway96/slopbro](https://github.com/throwaway96/slopbro) | 实机获取 root 权限时使用的工具；仓库不含 root 流程 |
| [webosbrew/webos-homebrew-channel](https://github.com/webosbrew/webos-homebrew-channel) | 电视端安装管理与 root 权限服务组件 |
| [webosbrew/youtube-webos](https://github.com/webosbrew/youtube-webos) | 独立安装的 YouTube AdFree，桌面提供快捷入口 |
| [ichikanya/Alcyone](https://github.com/ichikanya/Alcyone) | 独立安装的 VPN 应用，桌面显示连接状态与快捷入口 |

## 评估过但没有采用

按键接管方案比较过 [Simon34545/lginputhook](https://github.com/Simon34545/lginputhook) 与 [zzeppieri/webos-custom-home](https://github.com/zzeppieri/webos-custom-home)，两者都不是当前依赖。前期调研项目包括 [Gathin23/cleanyourtv](https://github.com/Gathin23/cleanyourtv)。动态磁贴布局参考了 [Jakub Kralka 的布局展示](https://x.com/jakubkralka/status/2112548525577785621) 与 [动效演示](https://x.com/jakubkralka/status/2112629158547423480)。

1.5.0 的系统 Home bind mount 启动方式参考了 [theboringhumane/theboringtv-lgwebos](https://github.com/theboringhumane/theboringtv-lgwebos) 的 `as-home.sh` 思路；本仓库的脚本按当前 appid、共享状态、内容缓存和回滚路径重写。

原生模块版本与校验值见[原生依赖来源](native.md)，摄影素材许可与作者署名见[素材记录](../app/ASSETS.md)。
