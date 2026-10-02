"""Keep the review route using the same approved responsive production UI."""
from pathlib import Path
root=Path(__file__).resolve().parents[1]
html=(root/'index.html').read_text()
html=html.replace('<meta charset="UTF-8">','<meta charset="UTF-8">\n  <base href="../../">')
html=html.replace('<title>甜橙 · Character Studio</title>','<title>手机排布预览 · Character Studio</title>')
html=html.replace('<a class="brand" href="./"','<a class="brand" href="previews/mobile/studio.html"')
(root/'previews/mobile').mkdir(parents=True,exist_ok=True)
(root/'previews/mobile/studio.html').write_text(html)
(root/'previews/mobile/index.html').write_text('''<!doctype html>
<html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>手机排布预览 · Character Studio</title>
<style>html,body{margin:0;background:#e4dcd0;min-height:100%;font-family:Arial,sans-serif}body{display:grid;place-items:center;min-height:100svh}iframe{display:block;width:390px;height:844px;max-width:100vw;border:0;border-radius:22px;box-shadow:0 14px 60px #45372826;margin:24px 0}@media(max-width:600px){iframe{width:100vw;height:100svh;border-radius:0;margin:0;box-shadow:none}}</style>
<iframe src="studio.html" title="手机穿搭摄影棚预览"></iframe>
</html>''')
print('Preview: http://127.0.0.1:8875/previews/mobile/')
