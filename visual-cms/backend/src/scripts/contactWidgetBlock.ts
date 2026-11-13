/**
 * Блок «Contact widget»: плавающая кнопка связи в правом нижнем углу.
 *
 * Свёрнут — одна круглая золотая кнопка. По нажатию над ней раскрывается
 * столбик круглых кнопок-каналов (телефон, Telegram, Instagram), сама кнопка
 * превращается в крестик. Закрывается крестиком, клавишей Esc и нажатием мимо.
 *
 * Свёрнутая кнопка по очереди показывает значки: чат, затем каждый канал из
 * меню (берутся из самих кнопок-каналов — добавленный в редакторе канал тоже
 * попадёт в круг). Пауза, пока виджет раскрыт, под курсором, в фокусе, вкладка
 * скрыта или посетитель просил меньше анимации.
 *
 * Оформление — из дизайна сайта: золото `#fdb82a` с переливом, как у кнопок
 * «Получить консультацию», тёмный `#15181d`, шрифт страницы.
 *
 * Значки — масками в CSS блока: узлов-SVG в структуре нет, а картинки из
 * медиатеки пришлось бы загружать отдельно. Канал задаётся классом
 * `gh-contacts-item--<канал>`; значки для WhatsApp, почты и YouTube уже есть
 * в CSS — чтобы добавить канал, достаточно скопировать кнопку в редакторе и
 * поменять класс и ссылку.
 *
 * Чистая сборка структуры; запись в базу — `create-contact-widget.ts`.
 */
import { StructureNode, makeNode } from './choiceToPlanTypes'

export const CONTACT_WIDGET_NAME = 'Contact widget'
export const CONTACT_WIDGET_ATTR = 'data-contact-widget'

/** Каналы, для которых в CSS есть значок. */
export const CHANNEL_KEYS = ['phone', 'telegram', 'instagram', 'whatsapp', 'email', 'youtube'] as const

/** Как часто свёрнутая кнопка меняет значок, мс. */
export const ICON_ROTATE_MS = 2000
/** Длительность угасания значка перед сменой, мс (= transition opacity у ::before в CSS). */
export const ICON_SWAP_MS = 360

export interface ContactChannel {
  /** Имя канала — суффикс класса значка. */
  key: (typeof CHANNEL_KEYS)[number]
  href: string
  /** Подпись слева от кнопки и текст для экранных читалок. */
  label: string
}

/** Каналы по умолчанию — те, что уже стоят в шапке и подвале сайта. */
export const DEFAULT_CHANNELS: ContactChannel[] = [
  { key: 'phone', href: 'tel:+998781501111', label: 'Позвонить' },
  { key: 'telegram', href: 'https://t.me/goldenhouseuz', label: 'Telegram' },
  { key: 'instagram', href: 'https://www.instagram.com/goldenhouseuz/', label: 'Instagram' },
]

const svg = (body: string): string =>
  `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E${body}%3C/svg%3E")`
const path = (d: string): string => `%3Cpath d='${d}'/%3E`

/** Значки (24×24, одноцветные — цвет задаёт кнопка). */
export const CONTACT_ICONS: Record<ContactChannel['key'] | 'chat' | 'close', string> = {
  chat: svg(path('M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z')),
  close: svg(path('M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z')),
  phone: svg(
    path(
      'M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.02-.24c1.12.37 2.33.57 3.57.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1.02l-2.2 2.2z',
    ),
  ),
  telegram: svg(
    path(
      'M21.9 4.3 18.7 19.4c-.2 1-.9 1.3-1.8.8l-4.9-3.6-2.4 2.3c-.3.3-.5.5-1 .5l.4-5 9.1-8.2c.4-.4-.1-.5-.6-.2L6.3 13.1l-4.8-1.5c-1-.3-1-1 .2-1.5l18.8-7.2c.9-.3 1.6.2 1.4 1.4z',
    ),
  ),
  instagram: svg(
    "%3Crect x='3' y='3' width='18' height='18' rx='5' fill='none' stroke='black' stroke-width='2'/%3E" +
      "%3Ccircle cx='12' cy='12' r='4' fill='none' stroke='black' stroke-width='2'/%3E" +
      "%3Ccircle cx='17.2' cy='6.8' r='1.2'/%3E",
  ),
  whatsapp: svg(
    // Кольцо с «хвостиком» и трубка внутри.
    "%3Cpath fill-rule='evenodd' d='M12 2a10 10 0 0 0-8.7 14.9L2 22l5.2-1.3A10 10 0 1 0 12 2zm0 1.9a8.1 8.1 0 1 1-4.3 15l-.4-.2-2.7.7.7-2.6-.3-.4A8.1 8.1 0 0 1 12 3.9z'/%3E" +
      path(
        'M8.7 7.3c-.3 0-.6.1-.8.4-.3.3-.9.9-.9 2.100 0 1.200.9 2.400 1 2.600.2.200 1.800 2.800 4.400 3.800 2.100.8 2.600.7 3 .6.500 0 1.500-.6 1.700-1.200.2-.600.2-1.100.2-1.200-.1-.2-.3-.200-.500-.400l-1.700-.8c-.200-.100-.400-.100-.600.100l-.8 1c-.1.2-.3.2-.5.1-.3-.1-1.100-.4-2-1.300-.8-.6-1.300-1.500-1.400-1.700-.2-.300 0-.400.1-.5l.4-.5.2-.4v-.4l-.8-1.900c-.2-.4-.4-.4-.5-.4z',
      ),
  ),
  email: svg(path('M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z')),
  youtube: svg(
    path(
      'M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4a2.5 2.5 0 0 0-1.8 1.800C2 8.800 2 12 2 12s0 3.200.4 4.800a2.500 2.500 0 0 0 1.800 1.800C5.800 19 12 19 12 19s6.200 0 7.800-.4a2.500 2.500 0 0 0 1.800-1.800c.4-1.600.4-4.800.4-4.800s0-3.200-.4-4.800zM10 15V9l5.200 3-5.200 3z',
    ),
  ),
}

const iconRule = (selector: string, icon: string): string =>
  `${selector}::before { -webkit-mask-image: ${icon}; mask-image: ${icon}; }`

export const CONTACT_WIDGET_CSS = `/* ============================================================
   БЛОК: CONTACT WIDGET — плавающая кнопка связи.
   Свёрнут: одна золотая кнопка. Раскрыт (.is-open): столбик
   каналов над ней, кнопка — крестик.
   Канал: класс gh-contacts-item--<phone|telegram|instagram|
   whatsapp|email|youtube>. Слой — ниже окон сайта (9990+).
   ============================================================ */

.gh-contacts {
  --gh-contacts-size: 56px;
  --gh-contacts-gold: #fdb82a;
  --gh-contacts-ink: #15181d;
  position: fixed;
  right: clamp(14px, 2vw, 28px);
  bottom: calc(clamp(14px, 2vw, 28px) + env(safe-area-inset-bottom, 0px));
  z-index: 9980;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 12px;
  font-family: inherit;
  /* Сам столбик нажатия не ловит — только кнопки: под ним остаётся страница. */
  pointer-events: none;
}

.gh-contacts-list {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 10px;
  margin: 0;
  padding: 0;
  /* Скрыт целиком: ссылки не ловят ни нажатия, ни Tab. Пропадает после того, как кнопки погаснут. */
  visibility: hidden;
  transition: visibility 0s linear .52s;
}

.gh-contacts.is-open .gh-contacts-list {
  visibility: visible;
  transition-delay: 0s;
}

.gh-contacts-item,
.gh-contacts-toggle {
  position: relative;
  box-sizing: border-box;
  flex: none;
  width: var(--gh-contacts-size);
  height: var(--gh-contacts-size);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 50%;
  cursor: pointer;
  text-decoration: none;
  pointer-events: auto;
  -webkit-tap-highlight-color: transparent;
}

/* Значок — маска: цвет берётся у кнопки (currentColor). */
.gh-contacts-item::before,
.gh-contacts-toggle::before {
  content: "";
  width: 46%;
  height: 46%;
  background: currentColor;
  -webkit-mask: center / contain no-repeat;
  mask: center / contain no-repeat;
}

/* ---------- каналы ---------- */

.gh-contacts-item {
  background: rgba(21, 24, 29, .92);
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, .14);
  box-shadow: 0 10px 26px rgba(13, 15, 18, .28);
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
  opacity: 0;
  transform: translateY(14px) scale(.86);
  transition: opacity .44s ease, transform .52s cubic-bezier(.2, .8, .2, 1), background-color .4s ease, color .4s ease;
}

.gh-contacts.is-open .gh-contacts-item {
  opacity: 1;
  transform: none;
}

/* Появляются по очереди снизу вверх: ближняя к кнопке — первой. */
.gh-contacts.is-open .gh-contacts-item:nth-last-child(2) { transition-delay: .08s; }
.gh-contacts.is-open .gh-contacts-item:nth-last-child(3) { transition-delay: .16s; }
.gh-contacts.is-open .gh-contacts-item:nth-last-child(4) { transition-delay: .24s; }
.gh-contacts.is-open .gh-contacts-item:nth-last-child(5) { transition-delay: .32s; }
.gh-contacts.is-open .gh-contacts-item:nth-last-child(n + 6) { transition-delay: .4s; }

.gh-contacts-item:hover,
.gh-contacts-item:focus-visible {
  background: var(--gh-contacts-gold);
  color: var(--gh-contacts-ink);
}

/* Подпись слева от кнопки. */
.gh-contacts-label {
  position: absolute;
  right: calc(100% + 10px);
  top: 50%;
  padding: 7px 12px;
  border-radius: 999px;
  background: rgba(21, 24, 29, .92);
  color: #ffffff;
  font-size: 13px;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
  opacity: 0;
  transform: translate(6px, -50%);
  transition: opacity .36s ease, transform .36s ease;
  pointer-events: none;
}

.gh-contacts-item:hover .gh-contacts-label,
.gh-contacts-item:focus-visible .gh-contacts-label {
  opacity: 1;
  transform: translate(0, -50%);
}

/* ---------- главная кнопка ---------- */

.gh-contacts-toggle {
  background: linear-gradient(115deg, #fdb82a 0%, #ffe08a 24%, #c98715 46%, #fdb82a 68%, #fff2b8 100%);
  background-size: 220% 100%;
  color: var(--gh-contacts-ink);
  box-shadow: 0 14px 32px rgba(201, 135, 21, .42), 0 2px 6px rgba(13, 15, 18, .18);
  animation: ghContactsShine 12s ease-in-out infinite;
  transition: transform .4s ease, box-shadow .4s ease;
}

.gh-contacts-toggle:hover,
.gh-contacts-toggle:focus-visible {
  transform: scale(1.06);
  box-shadow: 0 18px 38px rgba(201, 135, 21, .5), 0 2px 6px rgba(13, 15, 18, .2);
}

.gh-contacts-item:focus-visible,
.gh-contacts-toggle:focus-visible {
  outline: 2px solid #ffffff;
  outline-offset: 2px;
}

/* Кольцо-пульс, пока виджет свёрнут: кнопку видно на любом фоне. */
.gh-contacts-toggle::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 2px solid var(--gh-contacts-gold);
  opacity: 0;
  animation: ghContactsPulse 5.2s ease-out infinite;
  pointer-events: none;
}

.gh-contacts.is-open .gh-contacts-toggle::after {
  animation: none;
}

.gh-contacts-toggle::before {
  transition: transform .52s cubic-bezier(.2, .8, .2, 1), opacity .36s ease;
}

/* Смена значка у свёрнутой кнопки: старый гаснет, новый появляется. */
.gh-contacts-toggle.is-swapping::before {
  opacity: 0;
  transform: scale(.55);
}

.gh-contacts.is-open .gh-contacts-toggle::before {
  transform: rotate(90deg);
}

@keyframes ghContactsShine {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}

@keyframes ghContactsPulse {
  0% { opacity: .7; transform: scale(1); }
  70%, 100% { opacity: 0; transform: scale(1.55); }
}

/* ---------- значки ---------- */

${iconRule('.gh-contacts-toggle', CONTACT_ICONS.chat)}
${CHANNEL_KEYS.map((key) => iconRule(`.gh-contacts-item--${key}`, CONTACT_ICONS[key])).join('\n')}

/* Свёрнутая кнопка по очереди показывает значки каналов из меню (data-icon ставит скрипт). */
${CHANNEL_KEYS.map((key) => iconRule(`.gh-contacts-toggle[data-icon="${key}"]`, CONTACT_ICONS[key])).join('\n')}

/* Раскрыт — крестик, какой бы значок ни показывался до этого. */
${iconRule('.gh-contacts.is-open .gh-contacts-toggle[data-icon]', CONTACT_ICONS.close)}
${iconRule('.gh-contacts.is-open .gh-contacts-toggle', CONTACT_ICONS.close)}

/* ---------- телефон ---------- */

@media (max-width: 767px) {
  .gh-contacts {
    --gh-contacts-size: 52px;
    gap: 10px;
  }

  .gh-contacts-list {
    gap: 8px;
  }

  /* На сенсорном экране наведения нет — подписи видны сразу. */
  .gh-contacts.is-open .gh-contacts-label {
    opacity: 1;
    transform: translate(0, -50%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .gh-contacts-toggle,
  .gh-contacts-toggle::after {
    animation: none;
  }

  .gh-contacts-item,
  .gh-contacts-toggle::before,
  .gh-contacts-label {
    transition: none;
  }
}

@media print {
  .gh-contacts {
    display: none;
  }
}
`

/**
 * Раскрытие и закрытие. Один обработчик на документ: блок может стоять на
 * странице несколько раз (по экземпляру на экран) и в динамическом содержимом.
 */
export const CONTACT_WIDGET_JS = `(function () {
  if (window.__ghContactWidget) return;
  window.__ghContactWidget = true;

  var OPEN = "is-open";
  var ROOT = "[${CONTACT_WIDGET_ATTR}]";

  function setOpen(widget, open) {
    widget.classList.toggle(OPEN, open);
    var toggle = widget.querySelector(".gh-contacts-toggle");
    if (!toggle) return;
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    var label = toggle.getAttribute(open ? "data-label-close" : "data-label-open");
    if (label) toggle.setAttribute("aria-label", label);
  }

  function closeAll(except) {
    var opened = document.querySelectorAll(ROOT + "." + OPEN);
    for (var i = 0; i < opened.length; i++) {
      if (opened[i] !== except) setOpen(opened[i], false);
    }
  }

  document.addEventListener("click", function (event) {
    var target = event.target;
    if (!target || !target.closest) return;
    var toggle = target.closest(".gh-contacts-toggle");
    var widget = toggle ? toggle.closest(ROOT) : null;
    if (widget) {
      var open = !widget.classList.contains(OPEN);
      closeAll(widget);
      setOpen(widget, open);
      return;
    }
    // Нажатие по каналу — переход по ссылке, виджет остаётся открытым.
    if (target.closest(ROOT)) return;
    closeAll(null);
  });

  document.addEventListener("keydown", function (event) {
    if (event.key !== "Escape") return;
    var opened = document.querySelector(ROOT + "." + OPEN);
    if (!opened) return;
    closeAll(null);
    var toggle = opened.querySelector(".gh-contacts-toggle");
    if (toggle) toggle.focus();
  });

  // ---- Значок свёрнутой кнопки: чат, затем по очереди каналы из меню ----

  var KNOWN = ${JSON.stringify(CHANNEL_KEYS)};
  var ROTATE_MS = ${ICON_ROTATE_MS};
  var SWAP_MS = ${ICON_SWAP_MS};

  // Значки по порядку: чат и каналы меню (без повторов и без каналов, у которых нет значка).
  function iconsOf(widget) {
    var icons = ["chat"];
    var items = widget.querySelectorAll(".gh-contacts-item");
    for (var i = 0; i < items.length; i++) {
      var m = (items[i].className || "").match(/gh-contacts-item--([a-z]+)/);
      if (m && KNOWN.indexOf(m[1]) !== -1 && icons.indexOf(m[1]) === -1) icons.push(m[1]);
    }
    return icons;
  }

  function matches(el, selector) {
    try {
      return el.matches(selector);
    } catch (e) {
      return false;
    }
  }

  function reducedMotion() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  // Не мешаем: раскрыт, под курсором или в фокусе — значок стоит.
  function paused(widget) {
    return widget.classList.contains(OPEN) || matches(widget, ":hover") || matches(widget, ":focus-within");
  }

  function rotate(widget) {
    var toggle = widget.querySelector(".gh-contacts-toggle");
    if (!toggle) return;
    var icons = iconsOf(widget);
    if (icons.length < 2) return;
    var current = icons.indexOf(toggle.getAttribute("data-icon") || "chat");
    var next = icons[(current + 1) % icons.length];
    toggle.classList.add("is-swapping");
    setTimeout(function () {
      toggle.setAttribute("data-icon", next);
      toggle.classList.remove("is-swapping");
    }, SWAP_MS);
  }

  setInterval(function () {
    if (document.hidden || reducedMotion()) return;
    var widgets = document.querySelectorAll(ROOT);
    for (var i = 0; i < widgets.length; i++) {
      if (!paused(widgets[i])) rotate(widgets[i]);
    }
  }, ROTATE_MS);
})();
`

const ID = 'contact-widget'

function channelNode(channel: ContactChannel, index: number): StructureNode {
  const external = /^https?:/i.test(channel.href)
  return makeNode({
    id: `${ID}-item-${index + 1}`,
    tagName: 'a',
    elementType: 'container',
    attributes: {
      class: `gh-contacts-item gh-contacts-item--${channel.key}`,
      href: channel.href,
      'aria-label': channel.label,
      ...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {}),
    },
    children: [
      makeNode({
        id: `${ID}-item-${index + 1}-label`,
        tagName: 'span',
        elementType: 'text',
        content: channel.label,
        attributes: { class: 'gh-contacts-label', 'aria-hidden': 'true' },
      }),
    ],
  })
}

/** Структура блока «Contact widget». */
export function buildContactWidgetBlock(channels: ContactChannel[] = DEFAULT_CHANNELS): StructureNode {
  return makeNode({
    id: `${ID}-root`,
    tagName: 'div',
    elementType: 'container',
    attributes: { class: 'gh-contacts', [CONTACT_WIDGET_ATTR]: '' },
    metadata: { name: CONTACT_WIDGET_NAME, globalCss: CONTACT_WIDGET_CSS, globalJs: CONTACT_WIDGET_JS },
    children: [
      makeNode({
        id: `${ID}-list`,
        tagName: 'div',
        elementType: 'container',
        attributes: { class: 'gh-contacts-list' },
        children: channels.map(channelNode),
      }),
      makeNode({
        id: `${ID}-toggle`,
        tagName: 'button',
        elementType: 'button',
        content: '',
        attributes: {
          type: 'button',
          class: 'gh-contacts-toggle',
          'aria-label': 'Связаться с нами',
          'aria-expanded': 'false',
          'data-label-open': 'Связаться с нами',
          'data-label-close': 'Закрыть',
          'data-icon': 'chat',
        },
      }),
    ],
  })
}
