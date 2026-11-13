/**
 * @jest-environment jsdom
 *
 * Блок «Contact widget» (scripts/contactWidgetBlock.ts) и его создание
 * (scripts/create-contact-widget.ts).
 */
jest.mock('../config/database', () => ({ AppDataSource: { getRepository: () => ({}) } }))

import {
  CHANNEL_KEYS,
  CONTACT_ICONS,
  ICON_ROTATE_MS,
  ICON_SWAP_MS,
  CONTACT_WIDGET_ATTR,
  CONTACT_WIDGET_CSS,
  CONTACT_WIDGET_JS,
  CONTACT_WIDGET_NAME,
  DEFAULT_CHANNELS,
  buildContactWidgetBlock,
} from '../scripts/contactWidgetBlock'
import { createContactWidget } from '../scripts/create-contact-widget'
import { htmlGenerator } from '../services/HtmlGenerator'
import { StructureNode, findAll, hasClass, incompleteNodes, walk } from '../scripts/choiceToPlanTypes'

const items = (root: StructureNode) => findAll(root, (n) => hasClass(n, 'gh-contacts-item'))

describe('buildContactWidgetBlock — структура', () => {
  const root = buildContactWidgetBlock()

  it('корень: класс, метка для скрипта, имя, CSS и JS блока', () => {
    expect(root.attributes).toMatchObject({ class: 'gh-contacts', [CONTACT_WIDGET_ATTR]: '' })
    expect(root.metadata).toMatchObject({ name: CONTACT_WIDGET_NAME, globalCss: CONTACT_WIDGET_CSS, globalJs: CONTACT_WIDGET_JS })
  })

  it('все узлы в полной форме, которую ждёт редактор, и с разными id', () => {
    expect(incompleteNodes(root)).toEqual([])
    const ids: string[] = []
    walk(root, (n) => ids.push(String(n.id)))
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('каналы по умолчанию — телефон, Telegram и Instagram сайта', () => {
    expect(items(root).map((n) => [n.attributes!.class, n.attributes!.href])).toEqual([
      ['gh-contacts-item gh-contacts-item--phone', 'tel:+998781501111'],
      ['gh-contacts-item gh-contacts-item--telegram', 'https://t.me/goldenhouseuz'],
      ['gh-contacts-item gh-contacts-item--instagram', 'https://www.instagram.com/goldenhouseuz/'],
    ])
  })

  it('внешние ссылки открываются в новой вкладке, звонок — нет', () => {
    const [phone, telegram] = items(root)
    expect(phone.attributes!.target).toBeUndefined()
    expect(telegram.attributes).toMatchObject({ target: '_blank', rel: 'noopener noreferrer' })
  })

  it('у канала есть название для читалок и подпись, которую можно править и переводить', () => {
    for (const [i, item] of items(root).entries()) {
      expect(item.attributes!['aria-label']).toBe(DEFAULT_CHANNELS[i].label)
      const [label] = item.children!
      expect(label).toMatchObject({ tagName: 'span', elementType: 'text', content: DEFAULT_CHANNELS[i].label })
      expect(hasClass(label, 'gh-contacts-label')).toBe(true)
    }
  })

  it('главная кнопка — после списка, настоящая кнопка с подписями для обоих состояний', () => {
    const [list, toggle] = root.children!
    expect(hasClass(list, 'gh-contacts-list')).toBe(true)
    expect(toggle.tagName).toBe('button')
    expect(toggle.attributes).toMatchObject({
      type: 'button',
      class: 'gh-contacts-toggle',
      'aria-expanded': 'false',
      'aria-label': 'Связаться с нами',
      'data-label-open': 'Связаться с нами',
      'data-label-close': 'Закрыть',
      'data-icon': 'chat',
    })
  })

  it('свой набор каналов', () => {
    const custom = buildContactWidgetBlock([{ key: 'whatsapp', href: 'https://wa.me/998781501111', label: 'WhatsApp' }])
    expect(items(custom)).toHaveLength(1)
    expect(items(custom)[0].attributes!.class).toBe('gh-contacts-item gh-contacts-item--whatsapp')
  })
})

describe('публикация: блок на странице', () => {
  const page = {
    id: 'page-root',
    tagName: 'div',
    elementType: 'container',
    attributes: {},
    styles: { properties: {} },
    metadata: {},
    children: [buildContactWidgetBlock()],
  }
  const html = htmlGenerator.generatePage(page as any, { metadata: { title: 'Тест' }, slug: 'test' } as any)

  it('разметка: корень с меткой, ссылки каналов, кнопка', () => {
    expect(html).toMatch(/<div[^>]*class="gh-contacts"[^>]*data-contact-widget/)
    expect(html).toMatch(/<a[^>]*class="gh-contacts-item gh-contacts-item--telegram"[^>]*href="https:\/\/t\.me\/goldenhouseuz"/)
    expect(html).toMatch(/<a[^>]*href="tel:\+998781501111"/)
    expect(html).toMatch(/<span[^>]*class="gh-contacts-label"[^>]*>Telegram<\/span>/)
    expect(html).toMatch(/<button[^>]*class="gh-contacts-toggle"[^>]*aria-expanded="false"/)
  })

  it('CSS и JS блока попадают на страницу по одному разу', () => {
    expect(html.split('.gh-contacts-toggle {').length - 1).toBeGreaterThanOrEqual(1)
    expect(html.split('window.__ghContactWidget = true').length - 1).toBe(1)
    expect(html.split('@keyframes ghContactsPulse').length - 1).toBe(1)
    // Значок дошёл до страницы без порчи кавычек.
    expect(html).toContain(CONTACT_ICONS.telegram)
  })
})

describe('CSS блока', () => {
  it('значок есть у главной кнопки, крестика и каждого канала', () => {
    for (const key of ['phone', 'telegram', 'instagram', 'whatsapp', 'email', 'youtube'] as const) {
      expect(CONTACT_WIDGET_CSS).toContain(`.gh-contacts-item--${key}::before { -webkit-mask-image: ${CONTACT_ICONS[key]}`)
    }
    expect(CONTACT_WIDGET_CSS).toContain(`.gh-contacts-toggle::before { -webkit-mask-image: ${CONTACT_ICONS.chat}`)
    expect(CONTACT_WIDGET_CSS).toContain(`.gh-contacts.is-open .gh-contacts-toggle::before { -webkit-mask-image: ${CONTACT_ICONS.close}`)
  })

  it('свёрнутая кнопка умеет показать значок любого канала; раскрытая — крестик поверх него', () => {
    for (const key of CHANNEL_KEYS) {
      expect(CONTACT_WIDGET_CSS).toContain(`.gh-contacts-toggle[data-icon="${key}"]::before { -webkit-mask-image: ${CONTACT_ICONS[key]}`)
    }
    // Правило крестика сильнее правила значка канала (больше классов) и идёт после него.
    const close = CONTACT_WIDGET_CSS.indexOf(`.gh-contacts.is-open .gh-contacts-toggle[data-icon]::before { -webkit-mask-image: ${CONTACT_ICONS.close}`)
    expect(close).toBeGreaterThan(CONTACT_WIDGET_CSS.lastIndexOf('.gh-contacts-toggle[data-icon="'))
    expect(CONTACT_WIDGET_CSS).toMatch(/\.gh-contacts-toggle\.is-swapping::before \{[^}]*opacity: 0/)
  })

  it('JS и CSS знают одни и те же каналы', () => {
    expect(CONTACT_WIDGET_JS).toContain(`var KNOWN = ${JSON.stringify(CHANNEL_KEYS)};`)
  })

  it('значки — корректные SVG в data-адресе, без символов, ломающих CSS', () => {
    for (const icon of Object.values(CONTACT_ICONS)) {
      expect(icon).toMatch(/^url\("data:image\/svg\+xml,%3Csvg [^"]+%3C\/svg%3E"\)$/)
      const markup = decodeURIComponent(icon.slice('url("data:image/svg+xml,'.length, -2))
      const doc = new DOMParser().parseFromString(markup, 'image/svg+xml')
      expect(doc.querySelector('parsererror')).toBeNull()
      expect(doc.documentElement.getAttribute('viewBox')).toBe('0 0 24 24')
    }
  })

  it('висит в углу поверх страницы, но ниже окон сайта (9990+); в цветах сайта', () => {
    expect(CONTACT_WIDGET_CSS).toContain('position: fixed')
    expect(CONTACT_WIDGET_CSS).toContain('z-index: 9980')
    expect(CONTACT_WIDGET_CSS).toContain('#fdb82a')
    expect(CONTACT_WIDGET_CSS).toContain('#15181d')
  })

  it('свёрнутый список скрыт целиком; скобки сбалансированы', () => {
    expect(CONTACT_WIDGET_CSS).toMatch(/\.gh-contacts-list \{[^}]*visibility: hidden/)
    expect(CONTACT_WIDGET_CSS.split('{').length).toBe(CONTACT_WIDGET_CSS.split('}').length)
  })
})

describe('JS блока — раскрытие и закрытие', () => {
  function mount(count = 1, channels: string[] = ['telegram']): HTMLElement[] {
    const links = channels
      .map((key) => `<a class="gh-contacts-item gh-contacts-item--${key}" href="#${key}"><span class="gh-contacts-label">${key}</span></a>`)
      .join('')
    document.body.innerHTML =
      '<main id="page">страница</main>' +
      Array.from({ length: count })
        .map(
          () =>
            `<div class="gh-contacts" ${CONTACT_WIDGET_ATTR}>` +
            `<div class="gh-contacts-list">${links}</div>` +
            '<button type="button" class="gh-contacts-toggle" aria-expanded="false" aria-label="Связаться с нами" data-label-open="Связаться с нами" data-label-close="Закрыть" data-icon="chat"></button>' +
            '</div>',
        )
        .join('')
    return Array.from(document.querySelectorAll<HTMLElement>(`[${CONTACT_WIDGET_ATTR}]`))
  }

  const toggleOf = (widget: HTMLElement) => widget.querySelector<HTMLElement>('.gh-contacts-toggle')!
  const isOpen = (widget: HTMLElement) => widget.classList.contains('is-open')
  const iconOf = (widget: HTMLElement) => toggleOf(widget).getAttribute('data-icon')

  // Таймер смены значков общий и запущен при подключении скрипта: шагаем ровно до его срабатывания.
  let installedAt = 0
  const toNextTick = () => jest.advanceTimersByTime(ICON_ROTATE_MS - ((Date.now() - installedAt) % ICON_ROTATE_MS))
  /** Один шаг круга: срабатывание таймера и угасание старого значка. */
  const rotateOnce = () => {
    toNextTick()
    jest.advanceTimersByTime(ICON_SWAP_MS)
  }

  beforeAll(() => {
    jest.useFakeTimers()
    installedAt = Date.now()
    // Скрипт вешает обработчики на документ один раз — как на странице.
    // eslint-disable-next-line no-eval
    window.eval(CONTACT_WIDGET_JS)
    window.eval(CONTACT_WIDGET_JS) // повторное подключение (два экземпляра блока) ничего не ломает
  })

  afterAll(() => {
    jest.useRealTimers()
  })

  describe('значок свёрнутой кнопки', () => {
    afterEach(() => {
      delete (window as any).matchMedia
      delete (document as any).hidden
    })

    it('по кругу: чат, затем каждый канал меню в его порядке', () => {
      const [widget] = mount(1, ['phone', 'telegram', 'instagram'])
      const seen = [iconOf(widget)]
      for (let i = 0; i < 4; i++) {
        rotateOnce()
        seen.push(iconOf(widget))
      }
      expect(seen).toEqual(['chat', 'phone', 'telegram', 'instagram', 'chat'])
    })

    it('смена плавная: сначала старый значок гаснет, потом ставится новый', () => {
      const [widget] = mount(1, ['phone'])
      toNextTick()
      expect(toggleOf(widget).classList.contains('is-swapping')).toBe(true)
      expect(iconOf(widget)).toBe('chat')
      jest.advanceTimersByTime(ICON_SWAP_MS)
      expect(toggleOf(widget).classList.contains('is-swapping')).toBe(false)
      expect(iconOf(widget)).toBe('phone')
    })

    it('канал, добавленный в редакторе, тоже в круге; повторы и каналы без значка пропускаются', () => {
      const [widget] = mount(1, ['whatsapp', 'whatsapp', 'vk', 'email'])
      const seen: Array<string | null> = []
      for (let i = 0; i < 3; i++) {
        rotateOnce()
        seen.push(iconOf(widget))
      }
      expect(seen).toEqual(['whatsapp', 'email', 'chat'])
    })

    it('раскрыт — значок стоит (видно крестик); после закрытия круг продолжается', () => {
      const [widget] = mount(1, ['phone', 'telegram'])
      rotateOnce()
      expect(iconOf(widget)).toBe('phone')

      toggleOf(widget).click()
      rotateOnce()
      rotateOnce()
      expect(iconOf(widget)).toBe('phone')
      expect(toggleOf(widget).classList.contains('is-swapping')).toBe(false)

      toggleOf(widget).click()
      toggleOf(widget).blur()
      rotateOnce()
      expect(iconOf(widget)).toBe('telegram')
    })

    it('кнопка в фокусе (клавиатура) — значок стоит', () => {
      const [widget] = mount(1, ['phone'])
      toggleOf(widget).focus()
      rotateOnce()
      expect(iconOf(widget)).toBe('chat')
      toggleOf(widget).blur()
      rotateOnce()
      expect(iconOf(widget)).toBe('phone')
    })

    it('вкладка скрыта или просили меньше анимации — значок стоит', () => {
      const [widget] = mount(1, ['phone'])
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
      rotateOnce()
      expect(iconOf(widget)).toBe('chat')
      delete (document as any).hidden

      ;(window as any).matchMedia = (query: string) => ({ matches: query.includes('reduce') })
      rotateOnce()
      expect(iconOf(widget)).toBe('chat')
    })

    it('каналов нет — остаётся чат', () => {
      const [widget] = mount(1, [])
      rotateOnce()
      rotateOnce()
      expect(iconOf(widget)).toBe('chat')
      expect(toggleOf(widget).classList.contains('is-swapping')).toBe(false)
    })

    it('несколько виджетов и виджет, добавленный позже, — меняются все', () => {
      mount(0)
      rotateOnce()
      const widgets = mount(2, ['phone'])
      rotateOnce()
      expect(widgets.map(iconOf)).toEqual(['phone', 'phone'])
    })
  })

  it('кнопка раскрывает и сворачивает; состояние и подпись — для читалок', () => {
    const [widget] = mount()
    const toggle = toggleOf(widget)

    toggle.click()
    expect(isOpen(widget)).toBe(true)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(toggle.getAttribute('aria-label')).toBe('Закрыть')

    toggle.click()
    expect(isOpen(widget)).toBe(false)
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(toggle.getAttribute('aria-label')).toBe('Связаться с нами')
  })

  it('нажатие мимо закрывает; нажатие по каналу — нет', () => {
    const [widget] = mount()
    toggleOf(widget).click()

    widget.querySelector<HTMLElement>('.gh-contacts-label')!.click()
    expect(isOpen(widget)).toBe(true)

    document.getElementById('page')!.click()
    expect(isOpen(widget)).toBe(false)
  })

  it('Esc закрывает и возвращает фокус на кнопку; другие клавиши — нет', () => {
    const [widget] = mount()
    toggleOf(widget).click()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    expect(isOpen(widget)).toBe(true)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(isOpen(widget)).toBe(false)
    expect(document.activeElement).toBe(toggleOf(widget))
  })

  it('два экземпляра: открытие одного закрывает другой, один щелчок — одно переключение', () => {
    const [first, second] = mount(2)
    toggleOf(first).click()
    expect([isOpen(first), isOpen(second)]).toEqual([true, false])
    toggleOf(second).click()
    expect([isOpen(first), isOpen(second)]).toEqual([false, true])
  })

  it('работает для виджета, добавленного на страницу позже', () => {
    mount(0)
    const [late] = mount(1)
    toggleOf(late).click()
    expect(isOpen(late)).toBe(true)
  })
})

describe('createContactWidget — запись в библиотеку', () => {
  function repo(existing: any = null) {
    const saved: any[] = []
    return {
      saved,
      findOne: jest.fn(async () => existing),
      create: jest.fn((data: any) => ({ ...data })),
      save: jest.fn(async (block: any) => {
        saved.push(block)
        return { id: 'new-id', ...block }
      }),
    }
  }
  const log = () => {}

  it('блока нет — создаётся переиспользуемым, со структурой виджета', async () => {
    const r = repo()
    expect(await createContactWidget(r as any, { log })).toBe('created')
    expect(r.findOne).toHaveBeenCalledWith({ where: { name: CONTACT_WIDGET_NAME } })
    expect(r.saved).toHaveLength(1)
    expect(r.saved[0]).toMatchObject({ name: CONTACT_WIDGET_NAME, type: 'section', isReusable: true, tags: [] })
    expect(r.saved[0].structure).toEqual(buildContactWidgetBlock())
  })

  it('блок уже есть — без --update ничего не трогает (правки из редактора целы)', async () => {
    const r = repo({ id: 'b1', name: CONTACT_WIDGET_NAME, structure: { edited: true } })
    expect(await createContactWidget(r as any, { log })).toBe('exists')
    expect(r.save).not.toHaveBeenCalled()
  })

  it('--update: копия, затем замена структуры того же блока', async () => {
    const existing = { id: 'b1', name: CONTACT_WIDGET_NAME, structure: { edited: true } }
    const r = repo(existing)
    const backup = jest.fn((block: any) => {
      expect(block.structure).toEqual({ edited: true }) // копия — до замены
      return '/backups/x.json'
    })
    expect(await createContactWidget(r as any, { update: true, backup, log })).toBe('updated')
    expect(backup).toHaveBeenCalledTimes(1)
    expect(r.saved[0].id).toBe('b1')
    expect(r.saved[0].structure).toEqual(buildContactWidgetBlock())
    expect(r.create).not.toHaveBeenCalled()
  })

  it('--dry-run ничего не пишет — ни при создании, ни при замене', async () => {
    const fresh = repo()
    expect(await createContactWidget(fresh as any, { dryRun: true, log })).toBe('dry-run')
    expect(fresh.save).not.toHaveBeenCalled()

    const present = repo({ id: 'b1', structure: {} })
    const backup = jest.fn()
    expect(await createContactWidget(present as any, { dryRun: true, update: true, backup, log })).toBe('dry-run')
    expect(present.save).not.toHaveBeenCalled()
    expect(backup).not.toHaveBeenCalled()
  })
})
