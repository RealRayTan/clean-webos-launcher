# 设置流媒体动态封面

1.3.0 为 Prime Video、Disney+ 和 HBO Max 提供共用 TMDB 片库查询。默认美国片库、中文标题；片单属于公开平台片库精选，不是平台官方热门榜或个人推荐。

## 配置 TMDB 凭据

1. 在 [TMDB API 设置](https://www.themoviedb.org/settings/api)申请 **API Read Access Token**。账号申请资料与条款由账号所有者填写和接受。
2. 将 Token 保存到仓库之外的私有文件。文件可以只包含 Token，也可以使用以下 JSON。不要将它添加到安装包或 GitHub。

```json
{
  "token": "",
  "region": "US",
  "language": "zh-CN",
  "bindings": {}
}
```

3. 按安装指南设置 `TV_HOST` 和 `TV_SSH_KEY`，再运行以下命令。替换示例私有文件路径。

```sh
python3 tools/configure-tmdb.py --token-file /absolute/private/path/tmdb.json --region US --language zh-CN
```

工具通过 SSH 标准输入传输凭据，保留原有平台绑定，将配置原子写入 `/var/lib/lg-c5-home/tmdb.json`，权限为 `0600`。终端只输出是否已配置、地区与语言。这个文件独立于应用安装目录，升级安装包不会覆盖它。

4. 在桌面的“设置 → 内容来源”刷新公开内容。服务会重新读取配置；无须重启电视。认证无效时显示错误，保留已有缓存。

## 加入首页与绑定平台

安装应用后，在“编辑桌面”中勾选。服务只为已安装且已识别的平台查询片单，首页选择不影响平台识别。

Prime Video 使用已确认的应用 ID `amazon`。Disney+ 和 HBO Max 使用精确标题别名识别。单独名为 `Max` 的应用不自动猜测平台，可在私有配置中给实际应用 ID 添加绑定。

```json
{
  "bindings": {
    "replace.with.actual.application.id": "hbo"
  }
}
```

绑定可选值为 `prime`、`disney`、`hbo`。上面的应用 ID 是占位示例，必须替换。电视 App ID 与 TMDB 平台 ID 不相同；适配器按地区查询 TMDB 平台清单，不把网上常见的数值 ID 当作固定事实。Prime 的附加频道与租买服务不并入普通订阅片库。

新增其他平台时，在 `service/streaming-platforms.json` 添加平台配置，填写已核对的 App ID、精确标题别名和 TMDB 平台名称。查询、下载、缓存、动画和详情复用现有实现。

## 片单规则

适配器分别查询电影与剧集，交错选择最多八条。优先使用中文片名，缺失时回退原名；只使用横向背景图。缺少横向图、成人内容、尚未上映的条目跳过。电影与剧集通过类型和 TMDB ID 共同去重。

片库按平台、地区和语言隔离缓存，每六小时更新；图片按 URL 共用缓存。失败保留原内容与原获取时间，重试至少间隔五分钟。修改地区不会把旧地区缓存作为新地区结果返回。四个已有公开来源仍按原规则更新。

点击详情中的“打开应用”进入对应 App；不承诺直接播放当前封面作品。TMDB 的观看平台信息没有提供完整的应用播放深链接。来源入口打开作品资料，来源面板保留 TMDB 标志、声明和 JustWatch 署名。

## 参考

- [TMDB Discover TV](https://developer.themoviedb.org/reference/discover-tv)。
- [TMDB Discover Movie](https://developer.themoviedb.org/reference/discover-movie)。
- [认证方式](https://developer.themoviedb.org/docs/authentication-application)。
- [观看平台与 JustWatch 署名](https://developer.themoviedb.org/reference/tv-series-watch-providers)。
- [TMDB 使用与署名要求](https://developer.themoviedb.org/docs/faq)。
