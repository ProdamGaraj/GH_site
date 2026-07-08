/**
 * Visual CMS Analytics Tracker
 * 
 * Лёгкий скрипт аналитики для встраивания в опубликованные сайты.
 * Собирает: pageview, блок-engagement, Web Vitals, запросы, скролл, клики, ошибки.
 * 
 * Использование:
 *   <script src="/api/analytics/tracker.js" data-page-id="UUID" data-page-slug="/my-page"></script>
 * 
 * Или программно:
 *   window.__vcms_analytics = { pageId: 'UUID', pageSlug: '/my-page', apiUrl: 'https://...' }
 */
;(function () {
  'use strict'

  // ─── Конфигурация ──────────────────────────────────────────

  var scriptTag = document.currentScript
  var config = window.__vcms_analytics || {}

  var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

  function validUuid(v) {
    return v && UUID_RE.test(v) ? v : null
  }

  var PAGE_ID = validUuid(config.pageId) || validUuid(scriptTag && scriptTag.getAttribute('data-page-id')) || null
  var PAGE_SLUG = config.pageSlug || (scriptTag && scriptTag.getAttribute('data-page-slug')) || window.location.pathname
  var API_URL = config.apiUrl || (scriptTag && scriptTag.getAttribute('data-api-url')) || '/api/analytics'

  var BATCH_INTERVAL = 5000    // Отправка батча каждые 5 сек
  var HEARTBEAT_INTERVAL = 15000  // Heartbeat каждые 15 сек
  var MAX_BATCH_SIZE = 30

  // ─── Идентификация ─────────────────────────────────────────

  function generateId() {
    return 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
    })
  }

  function getOrCreate(key, generator) {
    try {
      var v = localStorage.getItem(key)
      if (v) return v
      v = generator()
      localStorage.setItem(key, v)
      return v
    } catch (e) {
      return generator()
    }
  }

  var visitorId = getOrCreate('__vcms_vid', generateId)

  function getSessionId() {
    try {
      var sid = sessionStorage.getItem('__vcms_sid')
      if (sid) return sid
      sid = generateId()
      sessionStorage.setItem('__vcms_sid', sid)
      return sid
    } catch (e) {
      return generateId()
    }
  }

  var sessionId = getSessionId()

  // ─── Очередь событий ──────────────────────────────────────

  var eventQueue = []
  var sessionStart = Date.now()

  // Внутренние переходы не считаются источником трафика: реферер с того же
  // хоста, что и страница, — это self-referral, зануляем (иначе «Реферреры»
  // забиваются собственными страницами сайта).
  var REFERRER = document.referrer || null
  if (REFERRER) {
    try {
      if (new URL(REFERRER).host === window.location.host) REFERRER = null
    } catch (e) {}
  }

  function pushEvent(type, data) {
    var ev = {
      eventType: type,
      sessionId: sessionId,
      visitorId: visitorId,
      pageId: PAGE_ID,
      pageSlug: PAGE_SLUG,
      url: window.location.href,
      referrer: REFERRER,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
    }
    if (data) {
      for (var k in data) {
        if (data.hasOwnProperty(k)) ev[k] = data[k]
      }
    }
    eventQueue.push(ev)

    if (eventQueue.length >= MAX_BATCH_SIZE) {
      flush()
    }
  }

  function flush() {
    if (eventQueue.length === 0) return

    var batch = eventQueue.splice(0, MAX_BATCH_SIZE)
    var payload = JSON.stringify({ events: batch })

    // Используем sendBeacon для надёжности (не блокирует навигацию)
    if (navigator.sendBeacon) {
      navigator.sendBeacon(API_URL + '/track', new Blob([payload], { type: 'application/json' }))
    } else {
      var xhr = new XMLHttpRequest()
      xhr.open('POST', API_URL + '/track', true)
      xhr.setRequestHeader('Content-Type', 'application/json')
      xhr.send(payload)
    }
  }

  function sendHeartbeat() {
    var duration = Date.now() - sessionStart
    var payload = JSON.stringify({ sessionId: sessionId, duration: duration })

    if (navigator.sendBeacon) {
      navigator.sendBeacon(API_URL + '/heartbeat', new Blob([payload], { type: 'application/json' }))
    } else {
      var xhr = new XMLHttpRequest()
      xhr.open('POST', API_URL + '/heartbeat', true)
      xhr.setRequestHeader('Content-Type', 'application/json')
      xhr.send(payload)
    }
  }

  // ─── 1. Pageview ──────────────────────────────────────────

  pushEvent('session_start')
  pushEvent('pageview', {
    pageLoadTime: (performance.timing && performance.timing.loadEventEnd)
      ? performance.timing.loadEventEnd - performance.timing.navigationStart
      : null,
  })

  // ─── 2. Web Vitals ───────────────────────────────────────

  function observeWebVitals() {
    if (!('PerformanceObserver' in window)) return

    // LCP
    try {
      new PerformanceObserver(function (list) {
        var entries = list.getEntries()
        var last = entries[entries.length - 1]
        if (last) pushEvent('performance', { lcp: last.startTime })
      }).observe({ type: 'largest-contentful-paint', buffered: true })
    } catch (e) {}

    // FCP
    try {
      new PerformanceObserver(function (list) {
        var entries = list.getEntries()
        for (var i = 0; i < entries.length; i++) {
          if (entries[i].name === 'first-contentful-paint') {
            pushEvent('performance', { fcp: entries[i].startTime })
          }
        }
      }).observe({ type: 'paint', buffered: true })
    } catch (e) {}

    // CLS
    try {
      var clsValue = 0
      new PerformanceObserver(function (list) {
        var entries = list.getEntries()
        for (var i = 0; i < entries.length; i++) {
          if (!entries[i].hadRecentInput) clsValue += entries[i].value
        }
      }).observe({ type: 'layout-shift', buffered: true })
      // Отправляем CLS при уходе
      addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden') {
          pushEvent('performance', { cls: clsValue })
        }
      })
    } catch (e) {}

    // FID
    try {
      new PerformanceObserver(function (list) {
        var entries = list.getEntries()
        if (entries[0]) pushEvent('performance', { fid: entries[0].processingStart - entries[0].startTime })
      }).observe({ type: 'first-input', buffered: true })
    } catch (e) {}

    // TTFB
    try {
      var nav = performance.getEntriesByType('navigation')
      if (nav.length > 0) {
        pushEvent('performance', { ttfb: nav[0].responseStart })
      }
    } catch (e) {}

    // INP
    try {
      var inpValue = 0
      new PerformanceObserver(function (list) {
        var entries = list.getEntries()
        for (var i = 0; i < entries.length; i++) {
          var dur = entries[i].duration
          if (dur > inpValue) inpValue = dur
        }
      }).observe({ type: 'event', buffered: true })
      addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden' && inpValue > 0) {
          pushEvent('performance', { inp: inpValue })
        }
      })
    } catch (e) {}
  }

  observeWebVitals()

  // ─── 3. Scroll depth ─────────────────────────────────────

  var maxScroll = 0
  var lastScrollReport = 0

  function getScrollDepth() {
    var docHeight = Math.max(
      document.body.scrollHeight,
      document.body.offsetHeight,
      document.documentElement.scrollHeight,
      document.documentElement.offsetHeight
    )
    var winHeight = window.innerHeight
    var scrollTop = window.pageYOffset || document.documentElement.scrollTop
    if (docHeight <= winHeight) return 100
    return Math.round((scrollTop + winHeight) / docHeight * 100)
  }

  var scrollThrottleTimer = null
  window.addEventListener('scroll', function () {
    if (scrollThrottleTimer) return
    scrollThrottleTimer = setTimeout(function () {
      scrollThrottleTimer = null
      var depth = getScrollDepth()
      if (depth > maxScroll) {
        maxScroll = depth
        // Отправляем каждые 25%
        var milestone = Math.floor(depth / 25) * 25
        if (milestone > lastScrollReport) {
          lastScrollReport = milestone
          pushEvent('scroll', { scrollDepth: depth })
        }
      }
    }, 300)
  }, { passive: true })

  // ─── 4. Block visibility tracking ────────────────────────

  var blockTimers = {} // blockId → { startTime, totalTime }

  function trackBlocks() {
    if (!('IntersectionObserver' in window)) return

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var el = entry.target
        var blockId = el.getAttribute('data-block-id') || el.id
        var blockType = el.getAttribute('data-block-type') || el.tagName.toLowerCase()

        if (!blockId) return

        if (entry.isIntersecting) {
          blockTimers[blockId] = blockTimers[blockId] || { totalTime: 0 }
          blockTimers[blockId].startTime = Date.now()
          // Тип запоминаем: финализация при уходе со страницы шлёт block_leave
          // из таймера, и без типа блок раздваивался в статистике на 'unknown'.
          blockTimers[blockId].type = blockType

          pushEvent('block_view', {
            blockId: blockId,
            blockType: blockType,
          })
        } else {
          if (blockTimers[blockId] && blockTimers[blockId].startTime) {
            var duration = Date.now() - blockTimers[blockId].startTime
            blockTimers[blockId].totalTime += duration
            blockTimers[blockId].startTime = null

            pushEvent('block_leave', {
              blockId: blockId,
              blockType: blockType,
              blockViewDuration: duration,
            })
          }
        }
      })
    }, { threshold: [0, 0.25, 0.5, 0.75, 1.0] })

    // Наблюдаем за блоками с data-block-id или section/[id]
    var blocks = document.querySelectorAll('[data-block-id], section[id], [data-cms-block]')
    blocks.forEach(function (el) {
      observer.observe(el)
    })

    // MutationObserver для динамически добавленных блоков
    var mut = new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        m.addedNodes.forEach(function (node) {
          if (node.nodeType === 1) {
            if (node.hasAttribute && (node.hasAttribute('data-block-id') || node.hasAttribute('data-cms-block') || (node.tagName === 'SECTION' && node.id))) {
              observer.observe(node)
            }
            // Проверяем вложенные
            if (node.querySelectorAll) {
              var inner = node.querySelectorAll('[data-block-id], section[id], [data-cms-block]')
              inner.forEach(function (el) { observer.observe(el) })
            }
          }
        })
      })
    })
    mut.observe(document.body, { childList: true, subtree: true })
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', trackBlocks)
  } else {
    trackBlocks()
  }

  // ─── 5. Click tracking ──────────────────────────────────

  document.addEventListener('click', function (e) {
    var target = e.target
    var selector = ''

    // Строим минимальный CSS-селектор
    if (target.id) {
      selector = '#' + target.id
    } else if (target.className && typeof target.className === 'string') {
      selector = target.tagName.toLowerCase() + '.' + target.className.trim().split(/\s+/).slice(0, 2).join('.')
    } else {
      selector = target.tagName.toLowerCase()
    }

    // Найти ближайший блок
    var blockEl = target.closest('[data-block-id], [data-cms-block], section[id]')
    var blockId = blockEl ? (blockEl.getAttribute('data-block-id') || blockEl.id) : null
    var blockType = blockEl ? (blockEl.getAttribute('data-block-type') || null) : null

    pushEvent('click', {
      eventTarget: selector,
      blockId: blockId,
      blockType: blockType,
      metadata: {
        text: (target.textContent || '').slice(0, 50),
        href: target.href || target.closest('a')?.href || null,
      },
    })
  }, true)

  // ─── 6. Request interception (fetch & XHR) ──────────────

  // Классифицируем URL запроса
  function classifyRequest(url, method) {
    if (!url) return 'service'
    var lUrl = url.toLowerCase()
    var lMethod = (method || '').toUpperCase()

    // Preflight (CORS OPTIONS)
    if (lMethod === 'OPTIONS') return 'preflight'

    // Analytics-запросы (уже фильтруются, но на всякий случай)
    if (lUrl.indexOf('/api/analytics') !== -1) return 'analytics'

    // Статические ресурсы
    if (/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|eot|map|webp|avif)(\?|$)/i.test(lUrl)) return 'static'

    // Сервисные: favicon, manifest, robots, sitemap, service-worker
    if (/\/(favicon|manifest|robots|sitemap|sw|service-worker|workbox)/i.test(lUrl)) return 'service'

    // Сервисные: chrome-extension, moz-extension, data:, blob:
    if (/^(chrome-extension|moz-extension|data:|blob:)/i.test(lUrl)) return 'service'

    // Всё остальное API
    return 'api'
  }

  // Patch fetch
  var origFetch = window.fetch
  if (origFetch) {
    window.fetch = function (input, init) {
      var url = typeof input === 'string' ? input : (input.url || '')
      var method = (init && init.method) || 'GET'

      // Не трекаем свои запросы аналитики
      if (url.indexOf(API_URL) !== -1) return origFetch.apply(this, arguments)

      var category = classifyRequest(url, method)
      var start = Date.now()
      pushEvent('request_sent', {
        requestUrl: url.substring(0, 500),
        requestMethod: method.toUpperCase(),
        requestCategory: category,
      })

      return origFetch.apply(this, arguments).then(function (response) {
        var duration = Date.now() - start
        pushEvent('request_received', {
          requestUrl: url.substring(0, 500),
          requestMethod: method.toUpperCase(),
          requestStatus: response.status,
          responseTime: duration,
          requestCategory: category,
        })
        return response
      }).catch(function (err) {
        var duration = Date.now() - start
        pushEvent('request_received', {
          requestUrl: url.substring(0, 500),
          requestMethod: method.toUpperCase(),
          requestStatus: 0,
          responseTime: duration,
          requestCategory: category,
          metadata: { error: err.message },
        })
        throw err
      })
    }
  }

  // Patch XMLHttpRequest
  var origXHROpen = XMLHttpRequest.prototype.open
  var origXHRSend = XMLHttpRequest.prototype.send
  XMLHttpRequest.prototype.open = function (method, url) {
    this.__vcms_method = method
    this.__vcms_url = url
    return origXHROpen.apply(this, arguments)
  }
  XMLHttpRequest.prototype.send = function () {
    var self = this
    var url = self.__vcms_url || ''
    var method = self.__vcms_method || 'GET'

    // Не трекаем свои запросы
    if (typeof url === 'string' && url.indexOf(API_URL) !== -1) {
      return origXHRSend.apply(this, arguments)
    }

    var category = classifyRequest(String(url), method)
    var start = Date.now()
    pushEvent('request_sent', {
      requestUrl: String(url).substring(0, 500),
      requestMethod: method.toUpperCase(),
      requestCategory: category,
    })

    self.addEventListener('loadend', function () {
      var duration = Date.now() - start
      pushEvent('request_received', {
        requestUrl: String(url).substring(0, 500),
        requestMethod: method.toUpperCase(),
        requestStatus: self.status,
        responseTime: duration,
        requestCategory: category,
        responseSize: self.response ? (typeof self.response === 'string' ? self.response.length : null) : null,
      })
    })

    return origXHRSend.apply(this, arguments)
  }

  // ─── 6b. Static resources (img/css/js/fonts) ─────────────
  // fetch/XHR перехвачены выше; статику браузер грузит сам — берём её из
  // Performance API, иначе вкладка «Запросы» на статичном сайте пуста.

  function trackResourceEntry(entry) {
    if (!entry || !entry.name) return
    // fetch/xhr/beacon уже учтены перехватчиками; beacon — наша же аналитика
    var it = entry.initiatorType
    if (it === 'fetch' || it === 'xmlhttprequest' || it === 'beacon') return
    if (entry.name.indexOf('/api/analytics') !== -1) return

    pushEvent('request_received', {
      requestUrl: entry.name.substring(0, 500),
      requestMethod: 'GET',
      responseTime: Math.round(entry.duration),
      requestCategory: classifyRequest(entry.name, 'GET'),
      responseSize: entry.transferSize || null,
    })
  }

  function trackStaticResources() {
    if (!('PerformanceObserver' in window)) return
    try {
      // Уже загруженные до инициализации трекера
      performance.getEntriesByType('resource').forEach(trackResourceEntry)
      new PerformanceObserver(function (list) {
        list.getEntries().forEach(trackResourceEntry)
      }).observe({ type: 'resource' })
    } catch (e) {}
  }

  trackStaticResources()

  // ─── 7. Error tracking ──────────────────────────────────

  window.addEventListener('error', function (e) {
    pushEvent('error', {
      metadata: {
        message: e.message,
        filename: e.filename,
        lineno: e.lineno,
        colno: e.colno,
      },
    })
  })

  window.addEventListener('unhandledrejection', function (e) {
    pushEvent('error', {
      metadata: {
        type: 'unhandledrejection',
        message: e.reason ? (e.reason.message || String(e.reason)) : 'unknown',
      },
    })
  })

  // ─── 8. Form tracking ──────────────────────────────────

  document.addEventListener('focusin', function (e) {
    var form = e.target.closest('form')
    if (form && !form.__vcms_started) {
      form.__vcms_started = true
      pushEvent('form_start', {
        metadata: {
          formId: form.getAttribute('data-form-id') || form.id || null,
          action: form.action || null,
        },
      })
    }
  })

  document.addEventListener('submit', function (e) {
    var form = e.target
    if (form && form.tagName === 'FORM') {
      pushEvent('form_submit', {
        metadata: {
          formId: form.getAttribute('data-form-id') || form.id || null,
          action: form.action || null,
          fieldsCount: form.elements ? form.elements.length : 0,
        },
      })
      flush() // Сразу отправляем при submit
    }
  }, true)

  // ─── Батчинг и heartbeat ─────────────────────────────────

  setInterval(flush, BATCH_INTERVAL)
  setInterval(sendHeartbeat, HEARTBEAT_INTERVAL)

  // Финализация при уходе
  window.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') {
      // Финализируем блоки
      for (var bid in blockTimers) {
        if (blockTimers[bid].startTime) {
          var d = Date.now() - blockTimers[bid].startTime
          blockTimers[bid].totalTime += d
          blockTimers[bid].startTime = null
          pushEvent('block_leave', {
            blockId: bid,
            blockType: blockTimers[bid].type || null,
            blockViewDuration: d,
          })
        }
      }

      pushEvent('session_end', {
        scrollDepth: maxScroll,
        metadata: { duration: Date.now() - sessionStart },
      })

      flush()
      sendHeartbeat()
    }
  })

  window.addEventListener('beforeunload', function () {
    flush()
    sendHeartbeat()
  })

  // ─── Public API ──────────────────────────────────────────

  window.__vcms_track = function (eventType, data) {
    pushEvent(eventType || 'custom', data || {})
  }

})()
