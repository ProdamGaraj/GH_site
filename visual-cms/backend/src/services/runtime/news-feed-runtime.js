/**
 * Лента новостей на странице /news: поиск, фильтры и бесконечная подгрузка.
 *
 * Генератор вставляет файл в страницу, если в ней есть [data-news-feed]
 * (services/NewsFeedRuntime.ts). Разметка — блок «News feed»
 * (scripts/newsFeedBlock.ts):
 *   [data-news-feed]            корень (сетка карточек)
 *   [data-news-filters]         сюда рантайм собирает полосу фильтров
 *   [data-news-list]            карточки; первые пришли в HTML при деплое
 *   [data-news-card]            карточка
 *   [data-news-card-template]   скрытый образец карточки — по нему рисуются
 *                               догруженные: [data-news-link] (адрес и
 *                               заголовок), [data-news-cover] (img обложки),
 *                               [data-news-badge], [data-news-date],
 *                               [data-news-lead], [data-news-tags] с образцом
 *                               [data-news-tag]
 *   [data-news-status]          «Ничего не найдено», загрузка, ошибка
 *   [data-news-more]            метка внизу: подъехала к экрану — следующая порция
 *
 * Данные — публичная лента news-service (/news-api/public/news): там только
 * выкаченные на сайт новости, поэтому карточка не ведёт на 404. Фильтры:
 * поиск (сначала совпадения в заголовке), рубрика, теги «любой / все»,
 * период — быстрые варианты, месяц или свои даты. Состояние — в адресе
 * страницы: ссылкой на отфильтрованную ленту можно поделиться.
 */
;(function () {
  'use strict'

  if (window.ghNewsFeed) return

  var API = '/news-api/public/news'
  var PAGE_SIZE = 12
  var SEARCH_DELAY_MS = 300
  var LAZY_MARGIN = '600px 0px'

  var TEXT = {
    ru: {
      search: 'Поиск по новостям',
      all: 'Все',
      period: 'Период',
      tags: 'Теги',
      quick: 'Быстро',
      month: 'Месяц',
      custom: 'Свои даты',
      allTime: 'Всё время',
      week: 'За неделю',
      month30: 'За месяц',
      months3: 'За 3 месяца',
      year: 'За год',
      from: 'С',
      to: 'По',
      apply: 'Применить',
      anyTag: 'С любым из тегов',
      allTags: 'Со всеми сразу',
      anyHint: 'Новости хотя бы с одним из выбранных тегов',
      allHint: 'Только новости, у которых есть все выбранные теги',
      reset: 'Сбросить всё',
      remove: 'Убрать фильтр',
      nothing: 'Ничего не найдено.',
      loading: 'Загрузка…',
      failed: 'Не удалось загрузить новости.',
      retry: 'Повторить',
      monthNames: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'],
    },
    uz: {
      search: 'Yangiliklar boʻyicha qidiruv',
      all: 'Hammasi',
      period: 'Davr',
      tags: 'Teglar',
      quick: 'Tezkor',
      month: 'Oy',
      custom: 'Oʻz sanalarim',
      allTime: 'Butun vaqt',
      week: 'Bir hafta',
      month30: 'Bir oy',
      months3: '3 oy',
      year: 'Bir yil',
      from: 'Dan',
      to: 'Gacha',
      apply: 'Qoʻllash',
      anyTag: 'Istalgan teg bilan',
      allTags: 'Barcha teglar bilan',
      anyHint: 'Tanlangan teglardan kamida bittasi bor yangiliklar',
      allHint: 'Faqat barcha tanlangan teglar bor yangiliklar',
      reset: 'Hammasini tozalash',
      remove: 'Filtrni olib tashlash',
      nothing: 'Hech narsa topilmadi.',
      loading: 'Yuklanmoqda…',
      failed: 'Yangiliklarni yuklab boʻlmadi.',
      retry: 'Qayta urinish',
      monthNames: ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'],
    },
    en: {
      search: 'Search news',
      all: 'All',
      period: 'Period',
      tags: 'Tags',
      quick: 'Quick',
      month: 'Month',
      custom: 'Custom dates',
      allTime: 'All time',
      week: 'Past week',
      month30: 'Past month',
      months3: 'Past 3 months',
      year: 'Past year',
      from: 'From',
      to: 'To',
      apply: 'Apply',
      anyTag: 'With any of the tags',
      allTags: 'With all tags',
      anyHint: 'News with at least one of the selected tags',
      allHint: 'Only news that have all selected tags',
      reset: 'Reset all',
      remove: 'Remove filter',
      nothing: 'Nothing found.',
      loading: 'Loading…',
      failed: 'Could not load news.',
      retry: 'Retry',
      monthNames: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    },
  }

  /** Быстрые периоды: ключ → дней назад (включая сегодня). */
  var QUICK = { week: 7, month30: 30, months3: 90, year: 365 }

  function pageLang() {
    var lang = (document.documentElement.getAttribute('lang') || '').slice(0, 2).toLowerCase()
    return TEXT[lang] ? lang : 'ru'
  }

  // --- Даты ---

  function pad(n) {
    return (n < 10 ? '0' : '') + n
  }

  function isoDate(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
  }

  function daysAgo(today, days) {
    var d = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    d.setDate(d.getDate() - (days - 1))
    return d
  }

  /** Период → границы запроса { from, to }. */
  function rangeOf(period, today) {
    if (period.kind === 'quick' && QUICK[period.value]) return { from: isoDate(daysAgo(today, QUICK[period.value])), to: '' }
    if (period.kind === 'month' && /^\d{4}-\d{2}$/.test(period.value)) {
      var y = Number(period.value.slice(0, 4))
      var m = Number(period.value.slice(5, 7))
      return { from: period.value + '-01', to: period.value + '-' + pad(new Date(y, m, 0).getDate()) }
    }
    if (period.kind === 'custom') return { from: period.from || '', to: period.to || '' }
    return { from: '', to: '' }
  }

  function shortDate(iso) {
    var p = iso.split('-')
    return p.length === 3 ? p[2] + '.' + p[1] + '.' + p[0] : iso
  }

  // --- Состояние и адрес страницы ---

  function emptyState() {
    return { q: '', category: '', tags: [], tagMode: 'any', period: { kind: 'all', value: '', from: '', to: '' } }
  }

  var DAY = /^\d{4}-\d{2}-\d{2}$/

  function readUrl(search) {
    var p = new URLSearchParams(search)
    var s = emptyState()
    s.q = (p.get('q') || '').slice(0, 100)
    s.category = p.get('category') || ''
    s.tags = (p.get('tags') || '').split(',').filter(Boolean)
    s.tagMode = p.get('tagMode') === 'all' ? 'all' : 'any'
    if (QUICK[p.get('period')]) s.period = { kind: 'quick', value: p.get('period'), from: '', to: '' }
    else if (/^\d{4}-\d{2}$/.test(p.get('month') || '')) s.period = { kind: 'month', value: p.get('month'), from: '', to: '' }
    else if (DAY.test(p.get('from') || '') || DAY.test(p.get('to') || '')) {
      s.period = { kind: 'custom', value: '', from: DAY.test(p.get('from') || '') ? p.get('from') : '', to: DAY.test(p.get('to') || '') ? p.get('to') : '' }
    }
    return s
  }

  var OWN_PARAMS = ['q', 'category', 'tags', 'tagMode', 'period', 'month', 'from', 'to']

  function writeUrl(state) {
    var p = new URLSearchParams(location.search)
    OWN_PARAMS.forEach(function (k) {
      p.delete(k)
    })
    if (state.q) p.set('q', state.q)
    if (state.category) p.set('category', state.category)
    if (state.tags.length) p.set('tags', state.tags.join(','))
    if (state.tags.length > 1 && state.tagMode === 'all') p.set('tagMode', 'all')
    if (state.period.kind === 'quick') p.set('period', state.period.value)
    if (state.period.kind === 'month') p.set('month', state.period.value)
    if (state.period.kind === 'custom') {
      if (state.period.from) p.set('from', state.period.from)
      if (state.period.to) p.set('to', state.period.to)
    }
    var qs = p.toString()
    history.replaceState(history.state, '', location.pathname + (qs ? '?' + qs : '') + location.hash)
  }

  function isFiltered(state) {
    return Boolean(state.q || state.category || state.tags.length || state.period.kind !== 'all')
  }

  // --- Данные ---

  function queryString(view, offset) {
    var s = view.state
    var range = rangeOf(s.period, view.today())
    var p = new URLSearchParams({ lang: view.lang, offset: String(offset), limit: String(PAGE_SIZE) })
    if (s.q) p.set('q', s.q)
    if (s.category) p.set('category', s.category)
    if (s.tags.length) {
      p.set('tags', s.tags.join(','))
      p.set('tagMode', s.tagMode)
    }
    if (range.from) p.set('from', range.from)
    if (range.to) p.set('to', range.to)
    return p.toString()
  }

  function getJson(url, signal) {
    return fetch(url, { credentials: 'same-origin', signal: signal }).then(function (res) {
      if (!res.ok) throw new Error(url + ': HTTP ' + res.status)
      return res.json()
    })
  }

  // --- Карточки ---

  function setOrDrop(el, value, apply) {
    if (!el) return
    if (value) apply(el, value)
    else el.parentNode && el.parentNode.removeChild(el)
  }

  /** Карточка из образца: те же элементы и классы, данные — из ленты. */
  function renderCard(view, card) {
    var el = view.template.cloneNode(true)
    el.removeAttribute('hidden')
    el.removeAttribute('data-news-card-template')
    el.setAttribute('data-news-card', '')
    var link = el.querySelector('[data-news-link]')
    if (link) {
      link.setAttribute('href', card.url)
      link.textContent = card.title
    }
    var cover = card.cover && card.cover[0]
    setOrDrop(el.querySelector('[data-news-cover]'), cover, function (img, c) {
      img.setAttribute('src', c.image)
      img.style.objectPosition = c.position || ''
    })
    var category = card.category && card.category[0]
    setOrDrop(el.querySelector('[data-news-badge]'), category, function (badge, c) {
      badge.textContent = c.name
    })
    var date = el.querySelector('[data-news-date]')
    if (date) date.textContent = card.dateLabel
    var lead = el.querySelector('[data-news-lead]')
    if (lead) lead.textContent = card.lead
    var tags = el.querySelector('[data-news-tags]')
    var tagProto = tags && tags.querySelector('[data-news-tag]')
    if (tags && tagProto) {
      var holder = tagProto.parentNode
      holder.removeChild(tagProto)
      ;(card.tags || []).forEach(function (t) {
        var tag = tagProto.cloneNode(true)
        tag.textContent = t.name
        holder.appendChild(tag)
      })
    }
    return el
  }

  function cardsIn(view) {
    return view.list.querySelectorAll('[data-news-card]').length
  }

  // --- Сообщения ---

  function status(view, kind) {
    var el = view.status
    if (!el) return
    el.textContent = ''
    el.setAttribute('data-news-state', kind)
    if (kind === 'empty') {
      el.appendChild(document.createTextNode(view.t.nothing + ' '))
      if (isFiltered(view.state)) el.appendChild(button(view.t.reset, '', function () {
        update(view, emptyState())
      }))
    } else if (kind === 'loading') {
      el.textContent = view.t.loading
    } else if (kind === 'error') {
      el.appendChild(document.createTextNode(view.t.failed + ' '))
      el.appendChild(button(view.t.retry, '', function () {
        load(view, cardsIn(view) === 0 || view.replacing)
      }))
    }
  }

  // --- Загрузка ---

  /** Адреса карточек в ленте по порядку — чтобы сравнить HTML с живой лентой. */
  function cardUrls(view) {
    return Array.prototype.slice.call(view.list.querySelectorAll('[data-news-card] [data-news-link]')).map(function (a) {
      return a.getAttribute('href') || ''
    })
  }

  /**
   * Первые карточки в HTML — снимок на момент публикации страницы списка.
   * Новость, выкаченная позже, в нём отсутствует, а подгрузка без полной
   * порции не начинается — новость не видна до перепубликации списка. Поэтому
   * при открытии без фильтров сверяемся с живой лентой и, если она другая,
   * тихо подменяем карточки. Сбой — остаются карточки из HTML, без сообщений.
   */
  function refresh(view) {
    var seq = ++view.seq
    view.loading = true
    return getJson(API + '?' + queryString(view, 0))
      .then(function (page) {
        if (seq !== view.seq) return
        var fresh = (page.items || []).map(function (c) {
          return c.url
        })
        // Пустая живая лента при карточках в HTML — скорее сбой отчёта о
        // деплое, чем «новостей нет»: карточки из HTML не стираем.
        if (fresh.length === 0 && cardsIn(view) > 0) return
        if (fresh.join(' ') !== cardUrls(view).join(' ')) {
          Array.prototype.slice.call(view.list.querySelectorAll('[data-news-card]')).forEach(function (c) {
            c.parentNode.removeChild(c)
          })
          ;(page.items || []).forEach(function (card) {
            view.list.appendChild(renderCard(view, card))
          })
        }
        view.hasMore = Boolean(page.hasMore)
        view.total = page.total
        view.tagModeTotals = page.tagModeTotals || null
        status(view, cardsIn(view) === 0 ? 'empty' : 'idle')
      })
      .catch(function (err) {
        console.warn('[news-feed] refresh:', err && err.message ? err.message : err)
      })
      .then(function () {
        if (seq === view.seq) view.loading = false
      })
  }

  /** Порция ленты. replace — заново с первой карточки (фильтры сменились). */
  function load(view, replace) {
    if (view.loading && !replace) return Promise.resolve()
    if (view.controller) view.controller.abort()
    var controller = typeof AbortController === 'function' ? new AbortController() : null
    view.controller = controller
    var seq = ++view.seq
    view.loading = true
    view.replacing = replace
    status(view, 'loading')
    var offset = replace ? 0 : cardsIn(view)
    return getJson(API + '?' + queryString(view, offset), controller && controller.signal)
      .then(function (page) {
        if (seq !== view.seq) return // ответ на прошлые фильтры
        if (replace) {
          Array.prototype.slice.call(view.list.querySelectorAll('[data-news-card]')).forEach(function (c) {
            c.parentNode.removeChild(c)
          })
        }
        ;(page.items || []).forEach(function (card) {
          view.list.appendChild(renderCard(view, card))
        })
        view.hasMore = Boolean(page.hasMore)
        view.total = page.total
        view.tagModeTotals = page.tagModeTotals || null
        status(view, cardsIn(view) === 0 ? 'empty' : 'idle')
        renderModeCounts(view)
      })
      .catch(function (err) {
        if (seq !== view.seq || (err && err.name === 'AbortError')) return
        console.warn('[news-feed]', err && err.message ? err.message : err)
        status(view, 'error')
      })
      .then(function () {
        if (seq === view.seq) view.loading = false
      })
  }

  function update(view, state) {
    view.state = state
    writeUrl(state)
    renderFilters(view)
    return load(view, true)
  }

  // --- Полоса фильтров ---

  function el(tag, cls, text) {
    var node = document.createElement(tag)
    if (cls) node.className = cls
    if (text !== undefined) node.textContent = text
    return node
  }

  function button(text, cls, onClick) {
    var b = el('button', cls, text)
    b.type = 'button'
    b.addEventListener('click', onClick)
    return b
  }

  function chip(text, pressed, onClick) {
    var b = button(text, 'news-fchip', onClick)
    b.setAttribute('aria-pressed', pressed ? 'true' : 'false')
    return b
  }

  function periodLabel(view) {
    var p = view.state.period
    var t = view.t
    if (p.kind === 'quick') return t[p.value]
    if (p.kind === 'month') return t.monthNames[Number(p.value.slice(5, 7)) - 1] + ' ' + p.value.slice(0, 4)
    if (p.kind === 'custom') return (p.from ? shortDate(p.from) : '…') + ' — ' + (p.to ? shortDate(p.to) : '…')
    return t.period
  }

  function closePopovers(view, except) {
    view.popovers.forEach(function (pair) {
      if (pair.pop === except) return
      pair.pop.hidden = true
      pair.button.setAttribute('aria-expanded', 'false')
    })
  }

  function dropdown(view, label, isSet, fill) {
    var wrap = el('div', 'news-fdrop')
    var btn = button(label, 'news-fbtn' + (isSet ? ' is-set' : ''), function () {
      var open = pop.hidden
      closePopovers(view, open ? pop : null)
      pop.hidden = !open
      btn.setAttribute('aria-expanded', open ? 'true' : 'false')
    })
    btn.setAttribute('aria-haspopup', 'dialog')
    btn.setAttribute('aria-expanded', 'false')
    var pop = el('div', 'news-fpop')
    pop.hidden = true
    pop.setAttribute('role', 'dialog')
    pop.setAttribute('aria-label', label)
    fill(pop)
    view.popovers.push({ pop: pop, button: btn })
    wrap.appendChild(btn)
    wrap.appendChild(pop)
    return wrap
  }

  function withPeriod(view, period) {
    var s = Object.assign({}, view.state, { period: period })
    closePopovers(view)
    return update(view, s)
  }

  function periodPanel(view, pop) {
    var t = view.t
    var tabs = el('div', 'news-ftabs')
    tabs.setAttribute('role', 'tablist')
    var panels = {}
    var current = view.state.period.kind === 'month' || view.state.period.kind === 'custom' ? view.state.period.kind : 'quick'
    ;['quick', 'month', 'custom'].forEach(function (kind) {
      var tab = button(t[kind], '', function () {
        Object.keys(panels).forEach(function (k) {
          panels[k].hidden = k !== kind
          tabs.querySelector('[data-tab="' + k + '"]').setAttribute('aria-selected', k === kind ? 'true' : 'false')
        })
      })
      tab.setAttribute('role', 'tab')
      tab.setAttribute('data-tab', kind)
      tab.setAttribute('aria-selected', kind === current ? 'true' : 'false')
      tabs.appendChild(tab)
    })
    pop.appendChild(tabs)

    // Быстро
    var quick = el('div', 'news-fgrid')
    quick.setAttribute('data-panel', 'quick')
    quick.appendChild(chip(t.allTime, view.state.period.kind === 'all', function () {
      withPeriod(view, emptyState().period)
    }))
    Object.keys(QUICK).forEach(function (key) {
      var on = view.state.period.kind === 'quick' && view.state.period.value === key
      quick.appendChild(chip(t[key], on, function () {
        withPeriod(view, { kind: 'quick', value: key, from: '', to: '' })
      }))
    })
    panels.quick = quick

    // Месяц: только месяцы, в которых есть новости.
    var month = el('div', 'news-fmonths')
    month.setAttribute('data-panel', 'month')
    var byYear = {}
    ;((view.facets && view.facets.months) || []).forEach(function (m) {
      ;(byYear[m.month.slice(0, 4)] = byYear[m.month.slice(0, 4)] || {})[m.month] = m.count
    })
    Object.keys(byYear)
      .sort()
      .reverse()
      .forEach(function (year) {
        month.appendChild(el('div', 'news-fyear', year))
        var grid = el('div', 'news-fgrid')
        t.monthNames.forEach(function (name, i) {
          var key = year + '-' + pad(i + 1)
          var count = byYear[year][key]
          var on = view.state.period.kind === 'month' && view.state.period.value === key
          var b = chip(name.slice(0, 3), on, function () {
            withPeriod(view, { kind: 'month', value: key, from: '', to: '' })
          })
          b.title = name + ' ' + year + (count ? ' · ' + count : '')
          b.disabled = !count
          grid.appendChild(b)
        })
        month.appendChild(grid)
      })
    panels.month = month

    // Свои даты
    var custom = el('div', 'news-fcustom')
    custom.setAttribute('data-panel', 'custom')
    var dates = el('div', 'news-fdates')
    var from = el('input')
    var to = el('input')
    ;[
      [from, t.from, view.state.period.from],
      [to, t.to, view.state.period.to],
    ].forEach(function (row) {
      var label = el('label', '', row[1] + ' ')
      row[0].type = 'date'
      row[0].value = row[2] || ''
      if (view.facets && view.facets.firstDate) row[0].min = view.facets.firstDate
      if (view.facets && view.facets.lastDate) row[0].max = view.facets.lastDate
      label.appendChild(row[0])
      dates.appendChild(label)
    })
    custom.appendChild(dates)
    custom.appendChild(button(t.apply, 'news-fbtn news-fapply', function () {
      if (!from.value && !to.value) return withPeriod(view, emptyState().period)
      var a = from.value
      var b = to.value
      if (a && b && a > b) {
        var x = a
        a = b
        b = x
      }
      withPeriod(view, { kind: 'custom', value: '', from: a, to: b })
    }))
    panels.custom = custom

    ;['quick', 'month', 'custom'].forEach(function (k) {
      panels[k].hidden = k !== current
      pop.appendChild(panels[k])
    })
  }

  function renderModeCounts(view) {
    var box = view.root.querySelector('[data-news-tagmode]')
    if (!box) return
    var totals = view.tagModeTotals
    ;['any', 'all'].forEach(function (mode) {
      var count = box.querySelector('[data-count="' + mode + '"]')
      if (count) count.textContent = totals ? String(totals[mode]) : ''
    })
  }

  function tagsPanel(view, pop) {
    var t = view.t
    var grid = el('div', 'news-fgrid')
    ;((view.facets && view.facets.tags) || []).forEach(function (tag) {
      var on = view.state.tags.indexOf(tag.key) !== -1
      grid.appendChild(chip(tag.name, on, function () {
        var tags = on ? view.state.tags.filter(function (k) { return k !== tag.key }) : view.state.tags.concat(tag.key)
        update(view, Object.assign({}, view.state, { tags: tags })).then(function () {
          // окно тегов остаётся открытым — можно выбрать ещё
          var reopened = view.root.querySelector('.news-fdrop [data-tags-pop]')
          if (reopened) {
            reopened.hidden = false
            reopened.previousSibling.setAttribute('aria-expanded', 'true')
          }
        })
      }))
    })
    pop.setAttribute('data-tags-pop', '')
    pop.appendChild(grid)

    // Переключатель «любой / все» — только при 2+ тегах: при одном разницы нет.
    if (view.state.tags.length >= 2) {
      var mode = el('div', 'news-fmode')
      mode.setAttribute('data-news-tagmode', '')
      ;[
        ['any', t.anyTag],
        ['all', t.allTags],
      ].forEach(function (row) {
        var label = el('label')
        var radio = el('input')
        radio.type = 'radio'
        radio.name = 'news-tag-mode'
        radio.value = row[0]
        radio.checked = view.state.tagMode === row[0]
        radio.addEventListener('change', function () {
          update(view, Object.assign({}, view.state, { tagMode: row[0] }))
        })
        var text = el('span', '', row[1])
        var count = el('span', 'news-fcount')
        count.setAttribute('data-count', row[0])
        label.appendChild(radio)
        label.appendChild(text)
        label.appendChild(count)
        mode.appendChild(label)
      })
      mode.appendChild(el('p', 'news-fhint', view.state.tagMode === 'all' ? t.allHint : t.anyHint))
      pop.appendChild(mode)
    }
  }

  function activePills(view) {
    var t = view.t
    var box = el('div', 'news-factive')
    var s = view.state
    function pill(text, next) {
      var b = button(text + ' ×', 'news-fpill', function () {
        update(view, next)
      })
      b.setAttribute('aria-label', t.remove + ': ' + text)
      box.appendChild(b)
    }
    if (s.q) pill('«' + s.q + '»', Object.assign({}, s, { q: '' }))
    var cat = view.facets && view.facets.categories.filter(function (c) { return c.key === s.category })[0]
    if (s.category) pill(cat ? cat.name : s.category, Object.assign({}, s, { category: '' }))
    if (s.period.kind !== 'all') pill(periodLabel(view), Object.assign({}, s, { period: emptyState().period }))
    s.tags.forEach(function (key) {
      var tag = view.facets && view.facets.tags.filter(function (x) { return x.key === key })[0]
      pill(tag ? tag.name : key, Object.assign({}, s, { tags: s.tags.filter(function (k) { return k !== key }) }))
    })
    if (box.childNodes.length) box.appendChild(button(t.reset, 'news-freset', function () {
      update(view, emptyState())
    }))
    return box
  }

  function renderFilters(view) {
    var host = view.filters
    if (!host || !view.facets) return
    var t = view.t
    var focusedSearch = document.activeElement && document.activeElement.classList.contains('news-fsearch')
    host.textContent = ''
    view.popovers = []
    var bar = el('div', 'news-fbar')

    var search = el('input', 'news-fsearch')
    search.type = 'search'
    search.placeholder = t.search
    search.setAttribute('aria-label', t.search)
    search.value = view.state.q
    search.addEventListener('input', function () {
      clearTimeout(view.searchTimer)
      view.searchTimer = setTimeout(function () {
        update(view, Object.assign({}, view.state, { q: search.value.trim().slice(0, 100) })).then(function () {
          var again = host.querySelector('.news-fsearch')
          if (again) {
            again.focus()
            again.setSelectionRange && again.setSelectionRange(again.value.length, again.value.length)
          }
        })
      }, SEARCH_DELAY_MS)
    })
    bar.appendChild(search)

    if (view.facets.categories.length) {
      var cats = el('div', 'news-fcats')
      cats.setAttribute('role', 'group')
      cats.appendChild(chip(t.all, !view.state.category, function () {
        update(view, Object.assign({}, view.state, { category: '' }))
      }))
      view.facets.categories.forEach(function (c) {
        cats.appendChild(chip(c.name, view.state.category === c.key, function () {
          update(view, Object.assign({}, view.state, { category: c.key }))
        }))
      })
      bar.appendChild(cats)
    }

    bar.appendChild(dropdown(view, periodLabel(view), view.state.period.kind !== 'all', function (pop) {
      periodPanel(view, pop)
    }))
    if (view.facets.tags.length) {
      var label = view.state.tags.length ? t.tags + ': ' + view.state.tags.length : t.tags
      bar.appendChild(dropdown(view, label, view.state.tags.length > 0, function (pop) {
        tagsPanel(view, pop)
      }))
    }
    host.appendChild(bar)
    host.appendChild(activePills(view))
    renderModeCounts(view)
    if (focusedSearch) search.focus()
  }

  // --- Запуск ---

  function whenNear(target, run) {
    if (typeof window.IntersectionObserver !== 'function') return null
    var observer = new window.IntersectionObserver(
      function (entries) {
        if (entries.some(function (e) { return e.isIntersecting })) run()
      },
      { rootMargin: LAZY_MARGIN }
    )
    observer.observe(target)
    return observer
  }

  function mount(root) {
    if (root.ghNewsFeed) return root.ghNewsFeed
    var list = root.querySelector('[data-news-list]')
    var template = root.querySelector('[data-news-card-template]')
    if (!list || !template) return null
    var lang = pageLang()
    var staticCount = list.querySelectorAll('[data-news-card]').length
    var view = {
      root: root,
      lang: lang,
      t: TEXT[lang],
      list: list,
      template: template,
      filters: root.querySelector('[data-news-filters]'),
      status: root.querySelector('[data-news-status]'),
      more: root.querySelector('[data-news-more]'),
      state: readUrl(location.search),
      facets: null,
      popovers: [],
      // При первой загрузке в HTML полная порция — значит, может быть ещё.
      hasMore: staticCount >= PAGE_SIZE,
      loading: false,
      seq: 0,
      today: function () {
        return new Date()
      },
    }
    root.ghNewsFeed = view

    getJson(API + '/facets?lang=' + encodeURIComponent(lang))
      .then(function (facets) {
        view.facets = facets
        renderFilters(view)
      })
      .catch(function (err) {
        // Без вариантов фильтров лента всё равно листается — полосу не показываем.
        console.warn('[news-feed] facets:', err && err.message ? err.message : err)
      })

    // Пришли по ссылке с фильтрами — карточки из HTML не те, грузим заново;
    // без фильтров — сверяем снимок из HTML с живой лентой.
    if (isFiltered(view.state)) load(view, true)
    else refresh(view)

    if (view.more) {
      whenNear(view.more, function () {
        if (view.hasMore && !view.loading) load(view, false)
      })
    }

    document.addEventListener('click', function (e) {
      if (!view.popovers.length) return
      if (!e.target.closest || !e.target.closest('.news-fdrop')) closePopovers(view)
    })
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closePopovers(view)
    })
    return view
  }

  function init() {
    document.querySelectorAll('[data-news-feed]').forEach(mount)
  }

  window.ghNewsFeed = { mount: mount, rangeOf: rangeOf, readUrl: readUrl }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init)
  else init()
})()
