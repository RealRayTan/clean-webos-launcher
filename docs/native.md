# 原生依赖来源

本仓库不附带 `ezinject`、`libinputhookpp.so` 或已打包 IPK。JavaScript 适配器遵循 HomeBack 的 `homeback-remote-ipc-v1` 协议。

## 固定版本

| 项目 | 来源与版本 |
|---|---|
| webOS 前端 | [OmkarK97/webos-vibehack](https://github.com/OmkarK97/webos-vibehack)，`31a518aef23768067975f3ac2e464462a8046bab`，MIT |
| HomeBack 适配参考 | [angelcode1/webos-HomeBack](https://github.com/angelcode1/webos-HomeBack/tree/b6d88d53250d5aae641c52e7b161936ac075b478)，`b6d88d53250d5aae641c52e7b161936ac075b478` |
| inputhookpp | [sundermann/inputhookpp](https://github.com/sundermann/inputhookpp/tree/9dc3cf140cb1ae1dbe059525c72710deea7ecf7d)，GPL-3.0 |
| ezinject | [smx-smx/ezinject](https://github.com/smx-smx/ezinject/tree/607055c06b037eadc3992008940d99bdc4a14f53)，原始 COPYING 许可 |
| 本次使用的构建记录 | [HomeBack CI 37990334840](https://github.com/angelcode1/webos-HomeBack/actions/runs/37990334840)，产物名 `c5-inputhookpp-source-candidate` |

来源许可的副本保留在 `service/native/INPUTHOOKPP-GPL-3.0.txt` 和 `service/native/EZINJECT-COPYING.txt`。HomeBack 的构建脚本和补丁没有复制进本仓库，查看固定版本的 `native/build-native.sh`、`native/patch-inputhook.py` 和 `native/source-lock.json`。

## 产物与校验

`scripts/prepare_native.py` 接受解压目录路径，只接受以下文件和摘要。脚本先验证全部文件，再复制到本地 `service/native/`。操作步骤见 [安装指南](install.md)。

| 文件 | SHA256 |
|---|---|
| `ezinject` | `3a03f5ea162651315cdbe710f6da815c8dd2650ea733e401a6cdce06943741b5` |
| `libinputhookpp.so` | `97b573d314a5312deb89dc32ce966b8e4f1605ba4559dc9a8ebf3dcc6ffb8d47` |

CI 产物可能到期。无法取得该产物时，可参考固定版本构建流程重建，但本项目的严格摘要检查不会自动接受不同的重建结果。不要跳过校验便声称它与本次验证产物等价；新的产物需要独立核对和设备验收。

复制后的原生文件和生成的 IPK 均被 Git 忽略。若另行分发包含外部二进制的安装包，需要同时处理对应源码、补丁与许可；本仓库当前只发布源码和元数据，不提供二进制发布包。
