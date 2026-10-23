# 安装到已 root 的电视

本指南适用于已完成 root、Homebrew Channel 和密钥 SSH 的电视。它不执行 root，也不修改固件或画质设置。安装会占用 `com.gathin.tvhome` 应用 ID；如果已有同 ID 桌面，安装会覆盖该桌面。

下面沿用本次 C5 的目录和原生协议。其他机型需要先核对输入进程架构和依赖兼容性。公开版参数化安装工具经过本地语法检查，尚未在第二台电视上安装验证。

## 准备连接

1. 安装 Python 3.12、Node.js 22 和 webOS CLI。

```sh
npm install --global @webos-tools/cli
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

2. 设置自己的电视地址和 root SSH 密钥路径。

```sh
export TV_HOST='your-tv-address'
export TV_SSH_KEY='/absolute/path/to/your/root-ssh-key'
```

3. 先用 SSH 确认电视主机密钥并验证 root 连接。

```sh
ssh -i "$TV_SSH_KEY" "root@$TV_HOST" id
```

输出必须包含 `uid=0`。安装工具使用批处理 SSH，不会代替你接受未知主机密钥或输入密码。

## 同步应用并打包

1. 从电视同步应用列表。

```sh
.venv/bin/python tools/sync-apps.py "$TV_HOST"
```

首次配对会在电视上显示连接提示。允许后，配对凭据仅保存在本地、已被 Git 忽略的 `tools/.lgtv-key.json`。同步得到的 `app/apps.js` 是安装时快照，1.1.0 通过电视端助手刷新应用列表，新增应用后不必重新打包；此快照仅用于读取失败时回退。该文件会包含你的应用清单，已被 Git 忽略。仓库只跟踪 `app/apps.example.js` 示例。

2. 在 `app/config.js` 的 `computerInput` 中指定常用输入源，默认 HDMI 4。首页应用安装后在“编辑桌面”中选择。
3. 从 [原生依赖来源](native.md) 所列的固定构建记录取得 ARM32 产物，解压后验证并复制。

```sh
python3 scripts/prepare_native.py /absolute/path/to/native-artifact
```

4. 打包。

```sh
bash scripts/build.sh
```

输出为 `build/com.gathin.tvhome_1.5.2_all.ipk`。构建会核对原生依赖 SHA256，并保留未压缩的 JavaScript，便于比对安装文件。构建不连接电视。

## 安装并启用

```sh
.venv/bin/python tools/install.py
```

安装工具完成以下操作：

1. 如已有助手，核对进程工作目录后停止它。
2. 上传 IPK，等待电视报告安装完成。
3. 重新执行 Homebrew Channel 的 `elevate-service`，恢复安装时被重建的 Luna 权限。
4. 启动普通桌面一次，把已有首页应用、顺序、主题和背景同步到 `/var/lib/lg-c5-home/app-state.json`，供系统 Home 副本读取。
5. 保留并恢复原键位配置，关闭原生 Home 适配器，将桌面 bind mount 到 LG 原厂 Home 的 appid，并重启系统应用管理器 `sam`。
6. 将 `homeAutoLaunch` 设为 `off`，把启动输入指到桌面，注册启动钩子和助手。

工具不重启电视。启用后短按 Home、应用退出和开机都会直接到桌面。应用内返回键无法退出时，长按返回约 0.7 秒回到桌面。

## 停用与恢复启用

```sh
.venv/bin/python tools/desktop_mode.py off
.venv/bin/python tools/desktop_mode.py on
```

`off` 写停用标记、移除系统 Home 与启动钩子、卸载 bind mount、恢复原键位和 LG 原厂 Home，再重启 `sam`。它保留应用、root 和最近输入源设置。`on` 重新执行系统 Home 挂载和启动钩子。

系统 Home 使用 bind mount 覆盖，不写入系统分区。停用桌面不等于撤销 root；本仓库没有完整 unroot 流程。
