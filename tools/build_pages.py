#!/usr/bin/env python3
"""由 images.js + site.json 產生靜態內容頁（給搜尋引擎與家長閱讀）。

用法（在專案根目錄執行）：  python3 tools/build_pages.py
會產生／更新：about.html、parents.html、privacy.html、c/<類別>.html、sitemap.xml、robots.txt、puzzle/index.html（舊網址轉址），
並更新 index.html 內 SEO:BEGIN~END 區塊。新增類別或圖片後重跑即可。
設定在 site.json：網域 baseUrl、聯絡信箱 contactEmail、是否已啟用廣告 adsEnabled。
"""
import datetime, html, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
cfg = json.load(open('site.json', encoding='utf-8'))
BASE = cfg['baseUrl'].rstrip('/') + '/'
NAME = cfg['siteName']
ADS = bool(cfg.get('adsEnabled'))
EMAIL = (cfg.get('contactEmail') or '').strip()
ISSUES = cfg.get('issuesUrl', '')
SHORT = cfg.get('shortName', NAME)
ADSENSE = cfg.get('adsense') or {}
ADS_CLIENT = (ADSENSE.get('client') or '').strip()
ADS_SLOTS = ADSENSE.get('slots') or {}
import hashlib, glob
TODAY = datetime.date.today().isoformat()
esc = html.escape

# ---------- 讀取分類與圖片 ----------
js = open('images.js', encoding='utf-8').read()
cats = [dict(id=i, icon=ic, name=n) for i, ic, n in re.findall(r"\{\s*id:\s*'(\w+)',\s*icon:\s*'([^']+)',\s*name:\s*'([^']+)'\s*\}", js)]
imgs = [dict(id=i, seq=int(s), cat=c, name=n, src=src) for i, s, c, n, src in re.findall(
    r"\{\s*id:\s*'(\w+)',\s*seq:\s*(\d+),\s*cat:\s*'(\w+)',\s*name:\s*'([^']+)',\s*src:\s*'([^']+)'", js)]
themes = [c for c in cats if c['id'] != 'new']          # 「最新圖片」是動態分頁，不單獨成頁
assert themes and imgs, '讀不到分類或圖片'
by_cat = {c['id']: [i for i in imgs if i['cat'] == c['id']] for c in themes}

# ---------- 各主題的說明文字 ----------
COPY = {
 'animal': dict(
  intro='貓咪、小狗、兔子、企鵝、大象……這個主題收錄 16 種孩子最熟悉、最喜歡的動物。拼圖時，孩子會仔細觀察毛色、耳朵、尾巴和臉部的特徵，慢慢認識不同動物的樣子。',
  learn=['觀察動物的外形特徵（耳朵、尾巴、羽毛、鼻子）', '認識常見動物的名稱，累積詞彙', '培養專注力與手眼協調'],
  talk=['牠會發出什麼聲音？可以一起學學看', '牠住在哪裡？吃什麼？', '你最喜歡哪一隻動物？為什麼？']),
 'fruit': dict(
  intro='從蘋果、草莓、西瓜到甜甜圈、杯子蛋糕，這個主題收錄 16 種孩子愛吃的水果與點心。拼圖時順便認識顏色、形狀和食物的名稱。',
  learn=['認識水果與點心的名稱', '辨認紅、黃、綠、橘等顏色', '比較圓形、長條形等不同的形狀'],
  talk=['它是什麼顏色？摸起來、吃起來是什麼感覺？', '你吃過哪一種？最喜歡哪一種？', '水果對身體有什麼好處？']),
 'nature': dict(
  intro='太陽、月亮、星星、雲朵、花朵、大樹……這個主題帶孩子認識身邊的大自然。從白天到黑夜、從晴天到下雨，一起觀察天空和植物的變化。',
  learn=['認識天氣、天空與植物', '理解白天與黑夜、四季的差別', '培養觀察與愛護自然的態度'],
  talk=['今天天氣怎麼樣？像哪一張圖？', '白天看得到什麼？晚上呢？', '我們在哪裡看過花和樹？']),
 'vehicle': dict(
  intro='汽車、火車、飛機、帆船、消防車、救護車……這個主題收錄 16 種陸、海、空的交通工具。孩子在拼圖時，可以認識它們的樣子與用途。',
  learn=['認識陸地、海上、空中的交通工具', '了解各種車輛的功能（消防車救火、救護車載送傷病的人）', '建立基本的交通安全概念'],
  talk=['它在哪裡行駛？陸地、水上還是天空？', '消防車和救護車是做什麼的？聽到警笛聲要怎麼做？', '你搭過哪一種交通工具？']),
 'life': dict(
  intro='房子、書本、杯子、帽子、雨傘、時鐘……這個主題收錄 16 種日常生活中常見的物品。從身邊的東西開始，讓孩子把圖片、名稱和實物連結起來。',
  learn=['認識生活用品的名稱與用途', '把圖片和家裡的實物對照', '學習簡單的分類（穿的、用的、玩的）'],
  talk=['這個東西在家裡哪裡找得到？', '什麼時候會用到它？', '我們一起在家裡找找看有沒有這個東西？']),
 'festival': dict(
  intro='聖誕樹、紅包、燈籠、月餅、粽子、南瓜燈、生日蛋糕……這個主題收錄 16 種節日與慶典的代表圖案，讓孩子在拼圖中認識中西方的節慶與傳統。',
  learn=['認識中西方節日的代表物', '了解傳統節日的由來與習俗', '感受節慶的歡樂氣氛'],
  talk=['你喜歡哪一個節日？為什麼？', '過年或中秋節的時候，我們會做什麼？', '生日的時候，你最期待什麼？']),
 'learn': dict(
  intro='圓形、三角形、正方形、數字、英文字母、注音符號……這個主題把基礎的學習認知變成好玩的拼圖，適合在幼兒入學前一起練習。',
  learn=['認識基本形狀與顏色（含紅、黃、藍三原色）', '接觸數字、字母與注音符號的樣子', '培養觀察與比較的能力'],
  talk=['你看到幾個圓形？哪一個是三角形？', '紅色和黃色混在一起會變成什麼顏色？', '你的名字裡有哪些字母或注音？']),
 'story': dict(
  intro='公主、王子、城堡、獨角獸、小紅帽、魔鏡、神燈……這個主題收錄 16 個童話故事裡的角色與魔法物件，讓孩子在拼圖後，延伸說出屬於自己的故事。',
  learn=['認識經典童話的角色與場景', '練習用語言描述與講故事', '激發想像力與創造力'],
  talk=['這是哪個故事裡的？後來發生了什麼事？', '如果你有一根魔法棒，想變出什麼？', '請你把這個故事講給我聽']),
 'dino': dict(
  intro='暴龍、三角龍、劍龍、腕龍……這個主題帶孩子回到恐龍生活的年代。除了認識 10 種遠古動物，也包含恐龍蛋、腳印、化石、火山和隕石，一起想像遠古的世界。',
  learn=['認識各種恐龍的名字和外形差異', '分辨吃草與吃肉的恐龍（例如：三角龍吃草、暴龍吃肉）', '認識化石、隕石與火山，建立對遠古地球的好奇心'],
  talk=['哪一隻恐龍最大？哪一隻會飛？', '牠吃草還是吃肉？', '如果遇到恐龍，你會怎麼辦？'],
  note='小知識：翼龍和蛇頸龍嚴格來說不是恐龍，而是與恐龍同時代的爬行動物。'),
 'ocean': dict(
  intro='小丑魚、河豚、鯨魚、海豚、章魚、水母……這個主題帶孩子潛入海底世界，認識 16 種海洋生物與海底寶藏。',
  learn=['認識海洋裡的魚類與其他生物', '比較大小、形狀與顏色的差異', '培養愛護海洋的觀念'],
  talk=['牠是魚嗎？鯨魚和海豚是魚還是哺乳動物？', '牠是怎麼游泳的？', '我們可以怎麼保護海洋？（例如：不亂丟垃圾）']),
 'job': dict(
  intro='醫生、護士、警察、消防員、廚師、老師、太空人……這個主題收錄 16 種職業，讓孩子認識不同工作的人和他們使用的工具，從小學會感謝與尊重每一種工作。',
  learn=['認識各種職業與其特徵（制服、帽子、工具）', '了解不同職業如何幫助大家', '啟發對未來的想像'],
  talk=['他在做什麼工作？會用到什麼工具？', '生病的時候，誰會幫助我們？', '你長大以後想做什麼？']),
 'bug': dict(
  intro='瓢蟲、蜜蜂、蜻蜓、螞蟻、螳螂、螢火蟲……這個主題收錄 16 種野外常見的小生物，鼓勵孩子觀察並愛護身邊的小生命。',
  learn=['認識常見昆蟲與小動物的外形', '觀察身體部位（翅膀、觸角、腳的數量）', '培養尊重、愛護生命的態度'],
  talk=['牠有幾隻腳？有沒有翅膀？', '牠喜歡住在哪裡？吃什麼？', '看到小蟲的時候，我們可以怎麼做？'],
  note='小知識：蝸牛、蚯蚓和蜘蛛嚴格來說不是昆蟲，但同樣是野外常見的小動物，所以一起收錄在這個主題。'),
 'food': dict(
  intro='漢堡、披薩、水餃、拉麵、牛奶、紅蘿蔔、玉米……這個主題收錄 16 種日常飲食，從主食到點心、飲料與蔬菜，帶孩子認識食物名稱，並聊聊均衡飲食。',
  learn=['認識常見食物與餐點的名稱', '分辨主食、蔬菜、蛋奶肉類等食物類別', '建立不挑食、均衡飲食的概念'],
  talk=['這是什麼？你吃過嗎？', '早餐、午餐、晚餐你喜歡吃什麼？', '蔬菜為什麼也要吃？']),
 'sport': dict(
  intro='籃球、棒球、網球、溜滑梯、盪鞦韆、跳繩、滑板……這個主題收錄 16 種運動與遊戲，讓孩子認識球類與遊樂場的玩具，也鼓勵多動多玩。',
  learn=['認識各種運動與遊戲的名稱', '理解運動需要的器材', '培養愛運動的習慣與遵守規則的態度'],
  talk=['你玩過哪一種？和誰一起玩？', '玩的時候要注意什麼安全規則？', '我們可以一起做哪一種運動？']),
 'music': dict(
  intro='鋼琴、吉他、小提琴、鼓、小喇叭、長笛……這個主題收錄 16 種樂器與音樂相關的圖案，讓孩子認識它們的樣子，也想想它們會發出什麼聲音。',
  learn=['認識常見樂器的名稱與外形', '區分敲打、吹奏、彈撥的不同樂器', '培養對節奏與音樂的興趣'],
  talk=['你覺得它會發出什麼聲音？可以模仿看看嗎？', '它是用拍的、吹的還是彈的？', '我們一起打節拍，好不好？']),
 'space': dict(
  intro='水星、金星、地球、火星、木星、土星……這個主題帶孩子認識太陽系的八大行星，還有彗星、銀河、太空梭和望遠鏡，一起探索神秘的宇宙。',
  learn=['認識八大行星的名字與外觀（例如：土星有光環、地球有海洋）', '了解望遠鏡、人造衛星、太空梭的用途', '激發對科學與宇宙的好奇心'],
  talk=['哪一顆行星有漂亮的環？', '我們住在哪一顆星球？', '你想搭太空梭去哪裡？'],
  note='圖片為示意插圖，行星的大小與比例並非真實比例。'),
}
missing = [c['id'] for c in themes if c['id'] not in COPY]
if missing:
    sys.exit('缺少這些類別的說明文字（請在 COPY 補上）：%s' % ', '.join(missing))

# ---------- 共用版型 ----------
def contact_html():
    if EMAIL:
        return '電子郵件：<a href="mailto:%s">%s</a>' % (esc(EMAIL), esc(EMAIL))
    return '請到<a href="%s" rel="noopener">本專案的 GitHub 頁面</a>留言與我們聯繫。' % esc(ISSUES)

def pwa_head(pre):
    return f'''<link rel="manifest" href="{pre}manifest.webmanifest">
<meta name="theme-color" content="#FFF6DD">
<link rel="icon" type="image/svg+xml" href="{pre}icons/icon.svg">
<link rel="icon" type="image/png" sizes="32x32" href="{pre}icons/favicon-32.png">
<link rel="apple-touch-icon" href="{pre}icons/apple-touch-icon.png">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="{esc(SHORT)}">
'''

def page(path, title, desc, body, crumbs=None, extra_head='', ad=None):
    pre = '../' * path.count('/')
    url = BASE + path
    crumb = ''
    if crumbs:
        crumb = '<p class="crumbs">' + ' › '.join('<a href="%s">%s</a>' % (esc(h), esc(t)) if h else esc(t) for t, h in crumbs) + '</p>'
    return f"""<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(title)}</title>
<meta name="description" content="{esc(desc)}">
<link rel="canonical" href="{esc(url)}">
<meta name="robots" content="index,follow">
<meta property="og:type" content="website">
<meta property="og:locale" content="zh_TW">
<meta property="og:site_name" content="{esc(NAME)}">
<meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(desc)}">
<meta property="og:url" content="{esc(url)}">
<link rel="stylesheet" href="{pre}pages.css">
{pwa_head(pre)}{extra_head}</head>
<body>
<header class="top"><div class="wrap">
  <a class="brand" href="{pre}index.html">🧩 {esc(NAME)}</a>
  <nav><a href="{pre}index.html">開始玩</a><a href="{pre}parents.html">家長須知</a><a href="{pre}about.html">關於我們</a></nav>
  <a class="homeicon" href="{pre}index.html" aria-label="回首頁" title="回首頁">🏠</a>
</div></header>
<main class="wrap">
{crumb}
{body}
{('<aside class="ad-slot" data-slot="%s" aria-label="廣告" hidden></aside>' % ad) if ad else ''}
</main>
{footer(pre)}
<script src="{pre}ads-config.js"></script>
<script src="{pre}ads.js"></script>
</body>
</html>
"""

def footer(pre):
    links = ' '.join('<a href="%sc/%s.html">%s</a>' % (pre, c['id'], esc(c['name'])) for c in themes)
    return f"""<footer class="foot"><div class="wrap">
<p><strong>全部主題：</strong>{links}</p>
<p><a href="{pre}about.html">關於我們</a><a href="{pre}parents.html">家長須知</a><a href="{pre}privacy.html">隱私權政策</a><a href="{pre}index.html">開始玩</a></p>
<p>© {datetime.date.today().year} {esc(NAME)}．圖片為自製插圖。</p>
</div></footer>"""

def write(path, text):
    d = os.path.dirname(path)
    if d: os.makedirs(d, exist_ok=True)
    open(path, 'w', encoding='utf-8').write(text)

n_theme, n_img = len(themes), len([i for i in imgs])

# ---------- 各主題頁 ----------
for idx, c in enumerate(themes):
    t = COPY[c['id']]; items = by_cat[c['id']]
    cells = ''.join('<li><a href="../index.html?img=%s" title="玩「%s」拼圖"><figure><img src="../%s" alt="%s插圖（%s主題）" loading="lazy" decoding="async" width="200" height="200"><figcaption>%s</figcaption></figure></a></li>'
                    % (i['id'], esc(i['name']), i['src'], esc(i['name']), esc(c['name']), esc(i['name'])) for i in items)
    others = ''.join('<li><a href="%s.html">%s %s</a></li>' % (o['id'], o['icon'], esc(o['name'])) for o in themes if o['id'] != c['id'])
    prev_c, next_c = themes[idx - 1], themes[(idx + 1) % len(themes)]
    note = '<p class="note">%s</p>' % esc(t['note']) if t.get('note') else ''
    body = f"""<h1>{c['icon']} {esc(c['name'])}拼圖</h1>
<p class="lead">{esc(t['intro'])}</p>
{note}
<p><a class="cta" href="../index.html?cat={c['id']}">▶ 開始玩「{esc(c['name'])}」拼圖</a></p>
<p>可以選擇 9、12 或 16 片，並切換拼圖形或方塊，由簡單到困難慢慢挑戰。免費、免註冊。</p>
<h2>這個主題裡有什麼？（共 {len(items)} 張）</h2>
<p>點選任一張圖片，就可以直接開始拼。</p>
<ul class="grid">{cells}</ul>
<h2>學習重點</h2>
<ul>{''.join('<li>%s</li>' % esc(x) for x in t['learn'])}</ul>
<h2>和孩子一起聊聊</h2>
<p>拼完之後，可以試著問孩子：</p>
<ul>{''.join('<li>%s</li>' % esc(x) for x in t['talk'])}</ul>
<h2>其他主題</h2>
<ul class="chips">{others}</ul>
<p>上一個主題：<a href="{prev_c['id']}.html">{esc(prev_c['name'])}</a>　下一個主題：<a href="{next_c['id']}.html">{esc(next_c['name'])}</a></p>"""
    desc = '免費的%s幼兒拼圖：%s可選 9、12、16 片。%s' % (c['name'], '、'.join(i['name'] for i in items[:5]) + ' 等 %d 張可愛圖片，' % len(items), t['learn'][0])
    write('c/%s.html' % c['id'], page('c/%s.html' % c['id'], '%s拼圖｜%s' % (c['name'], NAME), desc, body,
          crumbs=[('首頁', '../index.html'), ('主題', None), (c['name'], None)], ad='theme'))

# ---------- 關於我們 ----------
about = f"""<h1>關於我們</h1>
<p class="lead">「{esc(NAME)}」是一個免費的線上拼圖遊戲，專為 2～6 歲的小朋友設計。孩子透過拖曳圖片、完成拼圖，認識動物、水果、交通工具、恐龍、宇宙等各種主題，在遊戲中學習。</p>
<h2>網站特色</h2>
<ul>
<li><strong>{n_theme} 個主題、{n_img} 張圖片：</strong>每個主題 16 張，持續增加中</li>
<li><strong>難度可選：</strong>9、12、16 片，另可切換「拼圖形」與「方塊」，也能開關上方的提示底圖</li>
<li><strong>專為幼兒設計：</strong>拼塊大、吸附範圍寬鬆，放錯會輕輕彈回，不會有負面提示；完成時有音效與慶祝動畫</li>
<li><strong>免費、免註冊：</strong>手機、平板、電腦都能直接玩，不需要安裝</li>
<li><strong>不蒐集孩子的資料：</strong>詳見<a href="privacy.html">隱私權政策</a></li>
</ul>
<h2>圖片來源</h2>
<p>網站上的圖片皆為自製插圖，以 CC0 公眾領域貢獻（Public Domain Dedication）方式釋出，可自由使用。</p>
<h2>主題一覽</h2>
<ul class="chips">{''.join('<li><a href="c/%s.html">%s %s</a></li>' % (c['id'], c['icon'], esc(c['name'])) for c in themes)}</ul>
<h2>聯絡我們</h2>
<p>如果您有建議、發現問題，或希望我們增加某個主題，歡迎聯絡我們。</p>
<p>{contact_html()}</p>"""
write('about.html', page('about.html', '關於我們｜' + NAME, '%s 是免費的幼兒拼圖遊戲，提供 %d 個主題、%d 張可愛圖片，適合 2～6 歲孩子在遊戲中學習。' % (NAME, n_theme, n_img), about,
      crumbs=[('首頁', 'index.html'), ('關於我們', None)]))

# ---------- 家長須知 ----------
img_mb = '%.1f' % (sum(os.path.getsize(f) for f in glob.glob('images/*.svg')) / 1048576.0)
parents = f"""<h1>家長須知</h1>
<p class="lead">給陪伴孩子玩拼圖的您：這裡說明怎麼玩、怎麼依孩子的年齡調整難度，以及使用螢幕的小提醒。</p>
<h2>怎麼玩？</h2>
<ol>
<li>在首頁選一個<strong>主題</strong>（例如「可愛動物」），再點選喜歡的<strong>圖片</strong>。</li>
<li>用手指（或滑鼠）把下方的拼塊<strong>拖曳</strong>到上方對應的位置。拼對會「叮」一聲並固定住，放錯會輕輕彈回去。</li>
<li>全部拼完會有慶祝畫面，可以選擇「再玩一次」或「換一張」。</li>
<li>拼不出來時，按上方的 👀 可以短暫看原圖。</li>
</ol>
<h2>依年齡調整難度（建議）</h2>
<p>每個孩子的發展速度不同，以下僅供參考，請依孩子的狀況彈性調整。</p>
<table>
<thead><tr><th>年齡</th><th>片數</th><th>形狀</th><th>上方底圖</th></tr></thead>
<tbody>
<tr><td>約 2～3 歲</td><td>9 片</td><td>方塊</td><td>有底圖</td></tr>
<tr><td>約 3～4 歲</td><td>9～12 片</td><td>拼圖形</td><td>有底圖</td></tr>
<tr><td>約 4～5 歲</td><td>12～16 片</td><td>拼圖形</td><td>有底圖</td></tr>
<tr><td>約 5～6 歲</td><td>16 片</td><td>拼圖形</td><td>無底圖（進階挑戰）</td></tr>
</tbody></table>
<p>設定方式：首頁右上角的 ⚙️ 可以選擇「拼圖形／方塊」與「有底圖／無底圖」；片數則在拼圖畫面上方切換 9、12、16 片。</p>
<h2>親子共玩小技巧</h2>
<ul>
<li><strong>一起玩，邊玩邊聊：</strong>每個<a href="c/animal.html">主題頁</a>都附有「和孩子一起聊聊」的問題，可以在拼完後延伸對話。</li>
<li><strong>從簡單開始：</strong>先用少片數建立成就感，再慢慢增加。</li>
<li><strong>多鼓勵、少糾正：</strong>放錯位置是學習的一部分，讓孩子自己嘗試。</li>
<li><strong>連結生活：</strong>拼完「水果」就去看看家裡的水果，拼完「交通工具」就觀察路上的車。</li>
</ul>
<h2>關於螢幕使用時間</h2>
<p>世界衛生組織（WHO）建議：2～4 歲幼兒每天靜態的螢幕時間不超過 1 小時，越少越好；未滿 2 歲則不建議接觸螢幕。建議由大人陪伴、設定時間，並多安排戶外活動與面對面的互動。</p>
<h2>常見問題</h2>
<dl class="faq">
<dt>需要註冊或付費嗎？</dt><dd>不需要，完全免費，也不需要註冊帳號。</dd>
<dt>需要連上網路嗎？</dt><dd>第一次開啟需要網路。之後看過的內容會自動存在裝置上；如果想完全離線玩，可以在首頁右上角 ⚙️ 設定裡按「下載全部圖片」（約 {img_mb} MB），之後沒有網路也能玩。</dd>
<dt>可以安裝到手機主畫面嗎？</dt><dd>可以，像 App 一樣全螢幕開啟。<br>Android（Chrome）：點右上角選單，選「安裝應用程式」或「加到主畫面」，或使用 ⚙️ 設定裡的「安裝」按鈕。<br>iPhone／iPad（Safari）：點下方的「分享」圖示，再選「加入主畫面」。</dd>
<dt>會蒐集孩子的資料嗎？</dt><dd>不會。我們不要求任何個人資料，您選擇的設定只存在您自己的瀏覽器裡，詳見<a href="privacy.html">隱私權政策</a>。</dd>
<dt>哪些裝置可以玩？</dt><dd>手機、平板與電腦的主流瀏覽器都可以。手機建議直式或橫式皆可，系統會自動調整版面。</dd>
<dt>圖片可以拿去使用嗎？</dt><dd>網站圖片為自製插圖，以 CC0 公眾領域貢獻釋出，可自由使用。</dd>
<dt>我想要新的主題？</dt><dd>歡迎在<a href="about.html">關於我們</a>頁面留下聯絡方式與建議。</dd>
</dl>"""
write('parents.html', page('parents.html', '家長須知｜' + NAME, '幼兒拼圖怎麼玩、依年齡選擇 9／12／16 片與拼圖形或方塊、螢幕使用時間提醒與常見問題，給陪伴孩子的家長。', parents,
      crumbs=[('首頁', 'index.html'), ('家長須知', None)]))

# ---------- 隱私權政策 ----------
ads_sec = ''
if ADS:
    ads_sec = """<h2>廣告</h2>
<p>本網站使用 Google AdSense 顯示廣告，以支持網站持續營運。由於本網站的對象是兒童，我們已將廣告設定為<strong>兒童導向</strong>，僅顯示<strong>非個人化廣告</strong>，不會依據使用者的瀏覽行為投放個人化或再行銷廣告。</p>
<p>Google 及其合作夥伴可能會使用 Cookie 或類似技術，以提供與衡量廣告、防止詐欺及改善服務。您可以參閱 <a href="https://policies.google.com/technologies/ads" rel="noopener">Google 廣告政策與技術說明</a>，並透過 <a href="https://adssettings.google.com" rel="noopener">Google 廣告設定</a>管理廣告偏好，或在瀏覽器中封鎖或清除 Cookie。</p>
<p>遊戲操作畫面不會顯示廣告，廣告僅出現在首頁與各主題頁面。請家長留意，並提醒孩子不要隨意點擊廣告。</p>"""
privacy = f"""<h1>隱私權政策</h1>
<p>最後更新：{TODAY}</p>
<p class="lead">「{esc(NAME)}」重視每位使用者，尤其是兒童的隱私。以下說明本網站如何處理資訊。</p>
<h2>1. 我們蒐集哪些資料</h2>
<p>本網站<strong>不需要註冊或登入</strong>，也<strong>不蒐集</strong>姓名、電子郵件、電話、地址、位置、照片、聲音等任何個人資料。</p>
<h2>2. 儲存在您裝置上的設定</h2>
<p>為了記住您的偏好，網站會使用瀏覽器的本機儲存空間（localStorage）保存以下設定：拼圖形狀（拼圖形／方塊）、是否顯示上方底圖、上次選擇的片數。這些資料<strong>只存在您自己的裝置上</strong>，不會傳送給我們。您可以隨時清除瀏覽器的網站資料來刪除。</p>
<p>為了讓網站載入更快、並支援離線使用與安裝到主畫面，網站會透過瀏覽器的快取儲存空間（Cache Storage／Service Worker）在您的裝置上保存遊戲檔案與圖片。這些檔案同樣只存在您的裝置上，不含任何個人資料，可隨時透過清除網站資料移除。</p>
<h2>3. 網站的託管與存取紀錄</h2>
<p>本網站由第三方平台託管。依平台的運作方式，伺服器可能會記錄一般性的連線資訊（例如 IP 位址、瀏覽器類型、存取時間），用於提供服務與維護安全。相關處理方式請參閱該平台的隱私權說明，例如 <a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement" rel="noopener">GitHub 隱私權聲明</a>。</p>
{ads_sec}
<h2>{'5' if ADS else '4'}. 兒童的隱私</h2>
<p>本網站專為幼兒設計，我們不會刻意向 13 歲以下兒童蒐集個人資料。建議家長陪同孩子使用，並提醒孩子不要在網路上透露個人資訊。</p>
<h2>{'6' if ADS else '5'}. 外部連結</h2>
<p>本網站可能包含連到其他網站的連結。這些網站有各自的隱私權政策，我們無法控制其內容與做法，請您自行留意。</p>
<h2>{'7' if ADS else '6'}. 政策的變更</h2>
<p>我們可能因服務調整或法規要求更新本政策，更新後會公布在此頁並修改上方的更新日期。</p>
<h2>{'8' if ADS else '7'}. 聯絡我們</h2>
<p>對本政策有任何疑問，歡迎與我們聯絡。{contact_html()}</p>"""
write('privacy.html', page('privacy.html', '隱私權政策｜' + NAME, '%s 的隱私權政策：不需註冊、不蒐集個人資料，設定只儲存在您自己的裝置上。' % NAME, privacy,
      crumbs=[('首頁', 'index.html'), ('隱私權政策', None)]))

# ---------- sitemap.xml / robots.txt ----------
urls = [('', '1.0')] + [('about.html', '0.5'), ('parents.html', '0.6'), ('privacy.html', '0.3')] + [('c/%s.html' % c['id'], '0.8') for c in themes]
write('sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
      ''.join('  <url><loc>%s</loc><lastmod>%s</lastmod><priority>%s</priority></url>\n' % (esc(BASE + u), TODAY, p) for u, p in urls) + '</urlset>\n')
write('robots.txt', 'User-agent: *\nAllow: /\n\nSitemap: %ssitemap.xml\n' % BASE)

# ---------- 舊網址轉址：拼圖原本放在 /puzzle/，搬到根目錄後讓舊連結（含 ?cat= ?img=）自動跳轉 ----------
write('puzzle/index.html', f"""<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="UTF-8">
<title>{esc(NAME)}</title>
<meta name="robots" content="noindex">
<link rel="canonical" href="{esc(BASE)}">
<meta http-equiv="refresh" content="0; url=../">
<script>location.replace('../' + location.search + location.hash);</script>
</head>
<body><p>網站已搬家，<a href="../">請按這裡前往「{esc(NAME)}」</a>。</p></body>
</html>
""")

# ---------- 更新 index.html 的 SEO 區塊 ----------
home_desc = '免費的幼兒拼圖遊戲：%d 個主題、%d 張可愛圖片，可選 9、12、16 片，支援拼圖形與方塊。適合 2～6 歲孩子認識動物、水果、交通工具、恐龍、宇宙等，免註冊、手機平板電腦都能玩。' % (n_theme, n_img)
seo = f"""<!-- SEO:BEGIN（由 tools/build_pages.py 自動產生，請勿手動修改） -->
  <title>{esc(NAME)}｜免費幼兒拼圖遊戲（9／12／16 片）</title>
  <meta name="description" content="{esc(home_desc)}">
  <link rel="canonical" href="{esc(BASE)}">
  <meta name="robots" content="index,follow">
  <meta name="theme-color" content="#FFF6DD">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="zh_TW">
  <meta property="og:site_name" content="{esc(NAME)}">
  <meta property="og:title" content="{esc(NAME)}｜免費幼兒拼圖遊戲">
  <meta property="og:description" content="{esc(home_desc)}">
  <meta property="og:url" content="{esc(BASE)}">
  {pwa_head('').strip().replace(chr(10), chr(10) + '  ')}
  <!-- SEO:END -->"""
foot = f"""<!-- FOOT:BEGIN（由 tools/build_pages.py 自動產生） -->
    <footer class="site-foot">
      <p class="topics"><strong>全部主題：</strong>{' '.join('<a href="c/%s.html">%s</a>' % (c['id'], esc(c['name'])) for c in themes)}</p>
      <p><a href="about.html">關於我們</a>｜<a href="parents.html">家長須知</a>｜<a href="privacy.html">隱私權政策</a></p>
    </footer>
    <!-- FOOT:END -->"""
h = open('index.html', encoding='utf-8').read()
for tag, block in (('SEO', seo), ('FOOT', foot)):
    pat = re.compile(r'<!-- %s:BEGIN.*?<!-- %s:END -->' % (tag, tag), re.S)
    assert pat.search(h), 'index.html 缺少 %s 標記' % tag
    h = pat.sub(lambda m: block, h, count=1)
open('index.html', 'w', encoding='utf-8').write(h)

# ---------- PWA：manifest ----------
manifest = {
  "id": "./", "name": NAME, "short_name": SHORT, "description": home_desc, "lang": "zh-Hant",
  "start_url": "./?source=pwa", "scope": "./", "display": "standalone", "orientation": "any",
  "background_color": "#FFF6DD", "theme_color": "#FFF6DD", "categories": ["education", "kids", "games"],
  "icons": [
    {"src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any"},
    {"src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any"},
    {"src": "icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"},
  ],
}
write('manifest.webmanifest', json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')

# ---------- 廣告設定（預設為 null＝完全不載入廣告） ----------
ads_on = ADS and bool(ADS_CLIENT)
write('ads-config.js', '/* 由 tools/build_pages.py 產生，請改 site.json */\nwindow.ADS_CONFIG = ' +
      (json.dumps({"client": ADS_CLIENT, "slots": ADS_SLOTS}, ensure_ascii=False) if ads_on else 'null') + ';\n')
if ads_on:
    write('ads.txt', 'google.com, %s, DIRECT, f08c47fec0942fa0\n' % ADS_CLIENT.replace('ca-pub-', 'pub-'))
elif os.path.exists('ads.txt'):
    os.remove('ads.txt')

# ---------- PWA：service worker（快取版本由檔案內容雜湊決定，內容一變就會自動更新） ----------
def digest(paths):
    h = hashlib.sha1()
    for f in sorted(paths):
        h.update(f.encode()); h.update(open(f, 'rb').read())
    return h.hexdigest()[:10]
shell = ['index.html', 'about.html', 'parents.html', 'privacy.html', 'style.css', 'pages.css', 'app.js', 'images.js', 'ads.js',
         'ads-config.js', 'manifest.webmanifest'] + sorted(glob.glob('c/*.html')) + sorted(glob.glob('icons/*.png')) + ['icons/icon.svg']
sw = open('tools/sw.template.js', encoding='utf-8').read()
sw = (sw.replace('__SHELL_VERSION__', digest(shell)).replace('__IMG_VERSION__', digest(glob.glob('images/*.svg')))
        .replace('__SHELL_FILES__', json.dumps(['./'] + shell, ensure_ascii=False)))
write('sw.js', sw)

print('完成：%d 個主題頁 + about/parents/privacy + sitemap.xml（%d 個網址）+ robots.txt；index.html 已更新（廣告：%s，聯絡信箱：%s；PWA：manifest + sw.js，快取版本 %s）' %
      (n_theme, len(urls), '啟用' if ads_on else '未啟用', EMAIL or '未設定', digest(shell)))
