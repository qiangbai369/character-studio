# Character Studio

甜橙、阿飒、知秋的2D角色摄影棚。每人8套穿搭，春夏秋冬各2套，共24套；一键OOTD、人物动作、灯光、杂志/拍立得场景、拍照和本地作品收藏。

- 在线体验：https://qiangbai369.github.io/character-studio/
- 当前版本：四季衣柜 v8 · 加载优化
- 三位角色和衣服沿用已确认的原始PNG；小卡片使用缩略图，动作展示使用同画幅无损WebP。
- 独立项目说明：[PROJECT.md](PROJECT.md)
- 优化细则（1、2已确认）：[docs/optimization-roadmap.md](docs/optimization-roadmap.md)
- 已确认上线基线：Git标签 `v8.0.0`；原始版本可随时回退。
- 本轮验证：[docs/performance-mobile-review.md](docs/performance-mobile-review.md)
- 待确认手机排布：[previews/mobile/](previews/mobile/)，与正式首页排布独立。

## 本地运行

双击 `Start.command`，或运行 `python3 serve.py` 后打开 http://127.0.0.1:8874/ 。运行网页无需安装npm依赖或API Key。

## 检查

需要Node.js；图像检查另需 `@napi-rs/canvas` 和 `sharp`。安装测试依赖后执行 `node --test tests/*.test.cjs`。

## 发布

GitHub Pages使用 `main` 分支根目录；`.nojekyll` 保持静态文件原样发布。所有资源使用相对路径，适合项目子目录访问。

## 收藏

上传图片、收藏与版本保存在访问者自己的浏览器中，不上传到服务器。不同网址和浏览器的数据独立；本地预览中的收藏不会自动出现在在线网址。长期保留请下载PNG。

当前仓库只包含网页源码、运行素材和可复现检查；制作过程的旧版参考、个人照片、截图、备份和本机路径留在本地源码包中。

## 派生资源与性能复测

原始PNG保留不变。安装`sharp`后运行 `node tools/build-display-assets.cjs` 可重新生成缩略图和无损动作图。`assets/derived-manifest.json` 记录原图哈希与派生尺寸。

性能测量使用 `python3 tools/performance_probe.py`；先把 `v8.0.0` 的 index、styles 和 js 文件放入被忽略的 `output/performance/baseline/`，assets链接到原始素材。普通和慢网均用同一个浏览器，`normal/before/`、`normal/after/`、`slow/before/`、`slow/after/`分别隔离缓存；相同路径重复访问测暖缓存。

手机预览以 `python3 tools/build-mobile-preview.py` 从正式HTML更新，但不改变正式HTML和CSS。
