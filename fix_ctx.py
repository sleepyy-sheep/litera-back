import re

with open(r'c:\Users\ASUS\Desktop\litera-back\frontend\index.html', encoding='utf-8') as f:
    txt = f.read()

# Find and replace book-card__actions blocks using regex
old_pattern = r'      <div class="book-card__actions">\s*<button class="more-btn" aria-label="[^"]*" aria-haspopup="true">[^<]*</button>\s*<button class="play-btn" aria-label="[^"]*">\s*<img src="log_img/play-svgrepo-com\.svg" alt="" aria-hidden="true">\s*</button>\s*</div>'

new_block = '''      <div class="book-card__actions">
        <div class="more-wrap">
          <button class="more-btn" aria-label="Дополнительные действия" aria-haspopup="true">\u2022\u2022\u2022</button>
          <div class="ctx-menu" role="menu" aria-label="Действия с книгой">
            <button class="ctx-menu__item ctx-action-edit" role="menuitem"><span class="ctx-menu__icon">\u270f</span> Изменить</button>
            <div class="ctx-menu__sep"></div>
            <button class="ctx-menu__item ctx-action-shelf" role="menuitem"><span class="ctx-menu__icon">\u2713</span> На полку</button>
            <div class="ctx-menu__sep"></div>
            <button class="ctx-menu__item ctx-menu__item--danger ctx-action-delete" role="menuitem"><span class="ctx-menu__icon">\U0001f5d1</span> Удалить</button>
          </div>
        </div>
        <button class="play-btn" aria-label="Продолжить чтение">
          <img src="log_img/play-svgrepo-com.svg" alt="" aria-hidden="true">
        </button>
      </div>'''

matches = re.findall(old_pattern, txt, re.DOTALL)
print(f'Found {len(matches)} matches')

new_txt = re.sub(old_pattern, new_block, txt, flags=re.DOTALL)

with open(r'c:\Users\ASUS\Desktop\litera-back\frontend\index.html', 'w', encoding='utf-8') as f:
    f.write(new_txt)

print('Done')
