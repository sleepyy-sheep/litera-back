import re

with open(r'c:\Users\ASUS\Desktop\litera-back\frontend\index.html', encoding='utf-8') as f:
    html = f.read()

# 1. Remove mobile-continue + mobile-subnav block from inside <main>
# They are between <main class="dashboard"> and <!-- ПАНЕЛЬ СОРТИРОВКИ -->
old_inside = '''  <!-- MOBILE: Continue reading banner + sub-nav -->
  <div class="mobile-continue" aria-label="Продолжите чтение">
    <div class="mobile-continue__text">
      <h2 class="mobile-continue__title">Продолжите чтение</h2>
      <p class="mobile-continue__book">Потерянные девушки Рима</p>
      <div class="mobile-continue__progress">
        <div class="mobile-continue__bar"><div class="mobile-continue__fill" style="width:80%"></div></div>
        <span class="mobile-continue__pct">80%</span>
      </div>
    </div>
    <div class="mobile-continue__cover-wrap">
      <span class="mobile-continue__star" aria-hidden="true">⭐</span>
      <img src="log_img/background_left_part.png" alt="Обложка" class="mobile-continue__cover">
    </div>
  </div>
  <div style="position:relative">
    <div class="mobile-subnav">
      <button class="mobile-subnav__sort" aria-label="Сортировка">≡↑</button>
      <div class="mobile-subnav__tabs">
        <button class="mobile-subnav__tab mobile-subnav__tab--active">Книги</button>
        <button class="mobile-subnav__tab">Полки</button>
      </div>
      <button class="mobile-subnav__more" id="mobile-more-btn" aria-label="Ещё">•••</button>
    </div>
    <!-- Mobile context menu -->
    <div class="mobile-ctx-menu" id="mobile-ctx-menu">
      <button class="mobile-ctx-menu__item" id="mobile-ctx-shelf"><span>✓</span> На полку</button>
      <button class="mobile-ctx-menu__item mobile-ctx-menu__item--danger" id="mobile-ctx-delete"><span>🗑</span> Удалить</button>
      <button class="mobile-ctx-menu__item" id="mobile-ctx-cancel"><span>✕</span> Отменить</button>
    </div>
  </div>

  <!-- ПАНЕЛЬ СОРТИРОВКИ -->'''

new_inside = '''  <!-- ПАНЕЛЬ СОРТИРОВКИ -->'''

if old_inside in html:
    html = html.replace(old_inside, new_inside)
    print("Removed mobile blocks from inside <main>")
else:
    print("WARNING: Could not find mobile blocks inside <main> - trying regex")
    # Try regex approach
    pattern = r'  <!-- MOBILE: Continue reading banner \+ sub-nav -->.*?  <!-- ПАНЕЛЬ СОРТИРОВКИ -->'
    match = re.search(pattern, html, re.DOTALL)
    if match:
        html = html[:match.start()] + '  <!-- ПАНЕЛЬ СОРТИРОВКИ -->' + html[match.end():]
        print("Removed via regex")
    else:
        print("ERROR: Could not remove mobile blocks")

# 2. Insert mobile blocks BEFORE <main class="dashboard">
mobile_html = '''<!-- ===== МОБИЛЬНЫЙ БЛОК: Продолжите чтение + суб-навигация ===== -->
<div class="mobile-top-area">

  <div class="mobile-continue" aria-label="Продолжите чтение">
    <div class="mobile-continue__text">
      <h2 class="mobile-continue__title">Продолжите чтение</h2>
      <p class="mobile-continue__book">Потерянные девушки Рима</p>
      <div class="mobile-continue__progress">
        <div class="mobile-continue__bar">
          <div class="mobile-continue__fill" style="width:80%"></div>
        </div>
        <span class="mobile-continue__pct">80%</span>
      </div>
    </div>
    <div class="mobile-continue__cover-wrap">
      <span class="mobile-continue__star" aria-hidden="true">⭐</span>
      <img src="log_img/background_left_part.png" alt="Обложка" class="mobile-continue__cover">
    </div>
  </div>

  <div class="mobile-subnav-wrap">
    <div class="mobile-subnav">
      <button class="mobile-subnav__sort" aria-label="Сортировка">≡↑</button>
      <div class="mobile-subnav__tabs">
        <button class="mobile-subnav__tab mobile-subnav__tab--active">Книги</button>
        <button class="mobile-subnav__tab">Полки</button>
      </div>
      <button class="mobile-subnav__more" id="mobile-more-btn" aria-label="Ещё">•••</button>
    </div>
    <div class="mobile-ctx-menu" id="mobile-ctx-menu" role="menu">
      <button class="mobile-ctx-menu__item" id="mobile-ctx-shelf" role="menuitem"><span>✓</span> На полку</button>
      <button class="mobile-ctx-menu__item mobile-ctx-menu__item--danger" id="mobile-ctx-delete" role="menuitem"><span>🗑</span> Удалить</button>
      <button class="mobile-ctx-menu__item" id="mobile-ctx-cancel" role="menuitem"><span>✕</span> Отменить</button>
    </div>
  </div>

</div>

'''

anchor = '<!-- ===== ОСНОВНОЙ КОНТЕНТ ===== -->\n<main class="dashboard">'
if anchor in html:
    html = html.replace(anchor, mobile_html + anchor)
    print("Inserted mobile blocks before <main>")
else:
    print("ERROR: Could not find anchor for mobile blocks")

with open(r'c:\Users\ASUS\Desktop\litera-back\frontend\index.html', 'w', encoding='utf-8') as f:
    f.write(html)

print("Done. Lines:", len(html.split('\n')))
