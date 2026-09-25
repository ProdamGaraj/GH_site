/**
 * Карта проекта на странице ЖК: MapLibre GL и свои тайлы OpenStreetMap (/map/).
 *
 * Генератор вставляет этот файл в страницу целиком, если в ней есть
 * [data-map] (services/MapRuntime.ts). Сама MapLibre весит ~800 КБ, поэтому
 * грузится лениво: когда карта подъезжает к экрану.
 *
 * Контракт разметки (блок «Complex location», данные — estate: mapHouse,
 * mapPoints, mapLegend):
 *   [data-map]               корень карты. Рантайм пишет data-map-state:
 *                            empty | waiting | loading | ready | failed
 *   [data-map-canvas]        сюда MapLibre рисует карту
 *   [data-map-point]         точка: data-id, data-kind (house|office|place),
 *                            data-type, data-lat, data-lng, data-color,
 *                            data-distance; название — в [data-map-point-name].
 *                            Список точек — он же запасной вид, если карта не
 *                            загрузилась, и текст для экранного диктора
 *   [data-map-filter="тип"]  кнопка легенды: прячет и показывает места типа
 *   [data-map-icon]          SVG иконки типа внутри кнопки легенды; метка
 *                            места берёт иконку отсюда
 *
 * Пути к MapLibre, pmtiles.js и стилю берутся из /map/manifest.json — его
 * пишет scripts/map/build-map-assets.sh. Всё, что касается самой библиотеки,
 * собрано в draw(); тесты подкладывают поддельные maplibregl и pmtiles.
 */
;(function () {
  'use strict'

  // Скрипт мог попасть на страницу дважды — второй экземпляр ничего не делает.
  if (window.ghProjectMap) return

  var BASE = '/map/'
  /** Карта начинает грузиться, когда до экрана остаётся столько. */
  var LAZY_MARGIN = '600px 0px'
  /** Столько ждём первой отрисовки, потом показываем список вместо карты. */
  var LOAD_TIMEOUT_MS = 20000
  var MAX_ZOOM = 18
  /** Ближе показ всех точек не подъезжает: иначе два соседних дома — это весь экран. */
  var FIT_MAX_ZOOM = 16
  var SINGLE_POINT_ZOOM = 15
  /**
   * Поля вокруг точек при показе всех сразу. Подписи дома и отдела продаж
   * стоят над точкой и шириной до ~200 px: сверху — легенда и высота подписи,
   * по бокам — половина подписи, иначе на телефоне её обрезает край карты.
   */
  var FIT_PADDING = { top: 110, right: 100, bottom: 30, left: 100 }
  /** Насколько за рамку тайлов можно увести карту, градусы (~5 км). */
  var PAN_MARGIN = 0.05

  /** Подписи MapLibre. Ключи — из её словаря (Map._getUIString). */
  var TEXT = {
    ru: {
      'CooperativeGesturesHandler.WindowsHelpText': 'Чтобы изменить масштаб, прокручивайте карту с зажатой Ctrl',
      'CooperativeGesturesHandler.MacHelpText': 'Чтобы изменить масштаб, прокручивайте карту с зажатой ⌘',
      'CooperativeGesturesHandler.MobileHelpText': 'Двигайте карту двумя пальцами',
      'NavigationControl.ZoomIn': 'Приблизить',
      'NavigationControl.ZoomOut': 'Отдалить',
      'AttributionControl.ToggleAttribution': 'Источники карты',
      'Map.Title': 'Карта',
      'Marker.Title': 'Метка на карте',
    },
    uz: {
      'CooperativeGesturesHandler.WindowsHelpText': 'Masshtabni o‘zgartirish uchun Ctrl tugmasini bosib turib aylantiring',
      'CooperativeGesturesHandler.MacHelpText': 'Masshtabni o‘zgartirish uchun ⌘ tugmasini bosib turib aylantiring',
      'CooperativeGesturesHandler.MobileHelpText': 'Xaritani ikki barmoq bilan suring',
      'NavigationControl.ZoomIn': 'Yaqinlashtirish',
      'NavigationControl.ZoomOut': 'Uzoqlashtirish',
      'AttributionControl.ToggleAttribution': 'Xarita manbalari',
      'Map.Title': 'Xarita',
      'Marker.Title': 'Xaritadagi belgi',
    },
    en: {
      'CooperativeGesturesHandler.WindowsHelpText': 'Use Ctrl + scroll to zoom the map',
      'CooperativeGesturesHandler.MacHelpText': 'Use ⌘ + scroll to zoom the map',
      'CooperativeGesturesHandler.MobileHelpText': 'Use two fingers to move the map',
      'NavigationControl.ZoomIn': 'Zoom in',
      'NavigationControl.ZoomOut': 'Zoom out',
      'AttributionControl.ToggleAttribution': 'Toggle attribution',
      'Map.Title': 'Map',
      'Marker.Title': 'Map marker',
    },
  }

  function pageText() {
    var lang = (document.documentElement.getAttribute('lang') || '').slice(0, 2).toLowerCase()
    return TEXT[lang] || TEXT.ru
  }

  // --- Разметка ---

  function coordinate(value, limit) {
    if (value === null || String(value).trim() === '') return null
    var n = Number(value)
    return isFinite(n) && Math.abs(n) <= limit ? n : null
  }

  /** Точки из разметки. Без координат точка пропускается, остальные остаются. */
  function readPoints(root) {
    var points = []
    root.querySelectorAll('[data-map-point]').forEach(function (el) {
      var lat = coordinate(el.getAttribute('data-lat'), 90)
      var lng = coordinate(el.getAttribute('data-lng'), 180)
      if (lat === null || lng === null) return
      var nameEl = el.querySelector('[data-map-point-name]') || el
      points.push({
        item: el,
        marker: null,
        id: el.getAttribute('data-id') || '',
        kind: el.getAttribute('data-kind') || 'place',
        type: el.getAttribute('data-type') || '',
        name: (nameEl.textContent || '').trim(),
        color: el.getAttribute('data-color') || '',
        distance: el.getAttribute('data-distance') || '',
        lat: lat,
        lng: lng,
      })
    })
    return points
  }

  /** SVG иконок из легенды: тип → узел <svg>. Метки получают копию узла, не строку. */
  function readIcons(root) {
    var icons = {}
    root.querySelectorAll('[data-map-filter]').forEach(function (button) {
      var svg = button.querySelector('[data-map-icon] svg')
      if (svg) icons[button.getAttribute('data-map-filter')] = svg
    })
    return icons
  }

  // --- Геометрия ---

  /** [[запад, юг], [восток, север]] всех точек. */
  function boundsOf(points) {
    var w = Infinity
    var s = Infinity
    var e = -Infinity
    var n = -Infinity
    points.forEach(function (p) {
      w = Math.min(w, p.lng)
      e = Math.max(e, p.lng)
      s = Math.min(s, p.lat)
      n = Math.max(n, p.lat)
    })
    return [
      [w, s],
      [e, n],
    ]
  }

  /**
   * Куда можно увести карту: рамка тайлов из manifest.json с запасом. Точка
   * за рамкой расширяет её — иначе карта не смогла бы её показать.
   */
  function panLimits(tileBox, points) {
    var b = boundsOf(points)
    var box = Array.isArray(tileBox) && tileBox.length === 4 ? tileBox : [b[0][0], b[0][1], b[1][0], b[1][1]]
    return [
      [Math.min(box[0], b[0][0]) - PAN_MARGIN, Math.min(box[1], b[0][1]) - PAN_MARGIN],
      [Math.max(box[2], b[1][0]) + PAN_MARGIN, Math.max(box[3], b[1][1]) + PAN_MARGIN],
    ]
  }

  // --- Метки ---

  function span(className, text) {
    var el = document.createElement('span')
    el.className = className
    if (text) el.textContent = text
    return el
  }

  /**
   * Элемент метки. Внешний div отдаётся MapLibre: его положение (transform)
   * ведёт библиотека. Свои position или transform на нём сдвигали метку при
   * масштабировании, поэтому всё оформление — на вложенных элементах.
   */
  function markerElement(point, icon) {
    var wrap = document.createElement('div')
    wrap.className = 'project-map-marker project-map-marker--' + point.kind
    wrap.setAttribute('data-map-marker', point.id)
    var label = point.distance ? point.name + ', ' + point.distance : point.name

    if (point.kind !== 'place') {
      // Дом и отдел продаж подписаны всегда, нажимать на них незачем.
      var badge = span('project-map-pin')
      badge.setAttribute('role', 'img')
      badge.setAttribute('aria-label', label)
      badge.appendChild(span('project-map-pin-label', point.name))
      wrap.appendChild(badge)
      return wrap
    }

    var pin = document.createElement('button')
    pin.type = 'button'
    pin.className = 'project-map-pin'
    pin.setAttribute('aria-label', label)
    if (point.color) pin.style.setProperty('--map-color', point.color)
    if (icon) {
      var holder = span('project-map-pin-icon')
      holder.setAttribute('aria-hidden', 'true')
      holder.appendChild(icon.cloneNode(true))
      pin.appendChild(holder)
    }
    var tip = span('project-map-tip')
    tip.setAttribute('aria-hidden', 'true')
    tip.appendChild(span('project-map-tip-name', point.name))
    if (point.distance) tip.appendChild(span('project-map-tip-distance', point.distance))
    wrap.appendChild(pin)
    wrap.appendChild(tip)
    return wrap
  }

  function closeTips(view) {
    view.points.forEach(function (p) {
      if (p.marker && p.marker.classList.contains('is-open')) {
        p.marker.classList.remove('is-open')
        p.marker.style.zIndex = ''
      }
    })
  }

  function toggleTip(view, marker) {
    var open = !marker.classList.contains('is-open')
    closeTips(view)
    if (!open) return
    marker.classList.add('is-open')
    // Открытая подсказка — поверх соседних меток.
    marker.style.zIndex = '3'
  }

  // --- Легенда ---

  /** Прячет и показывает места типа: и метки, и строки списка. */
  function applyFilter(view) {
    view.points.forEach(function (p) {
      var off = p.kind === 'place' && view.hidden[p.type] === true
      p.item.hidden = off
      if (p.marker) p.marker.hidden = off
    })
  }

  function setupFilter(view) {
    view.root.querySelectorAll('[data-map-filter]').forEach(function (button) {
      var type = button.getAttribute('data-map-filter')
      button.setAttribute('aria-pressed', 'true')
      button.addEventListener('click', function () {
        var off = view.hidden[type] !== true
        view.hidden[type] = off
        button.setAttribute('aria-pressed', off ? 'false' : 'true')
        if (off) closeTips(view)
        applyFilter(view)
      })
    })
  }

  // --- Загрузка библиотеки ---

  function fetchJson(url) {
    return fetch(url, { credentials: 'same-origin' }).then(function (res) {
      if (!res.ok) throw new Error(url + ': HTTP ' + res.status)
      return res.json()
    })
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var script = document.createElement('script')
      script.src = src
      script.async = true
      script.onload = function () {
        resolve()
      }
      script.onerror = function () {
        reject(new Error('не загрузился ' + src))
      }
      document.head.appendChild(script)
    })
  }

  function addStylesheet(href) {
    if (document.querySelector('link[data-map-css]')) return
    var link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = href
    link.setAttribute('data-map-css', '')
    document.head.appendChild(link)
  }

  /** Путь от корня сайта → полный адрес: MapLibre не принимает относительные. */
  function absolute(url) {
    return typeof url === 'string' && url.charAt(0) === '/' ? location.origin + url : url
  }

  /**
   * style.json собран с путями от корня (/map/…), чтобы один файл работал на
   * любом домене. Здесь они становятся полными. Строкой, а не через new URL:
   * URL закодировал бы {fontstack} и {range}, и MapLibre не нашла бы шрифты.
   */
  function absolutizeStyle(style) {
    var out = JSON.parse(JSON.stringify(style))
    out.glyphs = absolute(out.glyphs)
    if (typeof out.sprite === 'string') out.sprite = absolute(out.sprite)
    else if (Array.isArray(out.sprite)) {
      out.sprite.forEach(function (sprite) {
        sprite.url = absolute(sprite.url)
      })
    }
    Object.keys(out.sources || {}).forEach(function (key) {
      var source = out.sources[key]
      if (typeof source.url === 'string' && source.url.indexOf('pmtiles:///') === 0) {
        source.url = 'pmtiles://' + location.origin + source.url.slice('pmtiles://'.length)
      }
    })
    return out
  }

  var library = null

  /** MapLibre, pmtiles.js и стиль — один раз на страницу. */
  function loadLibrary() {
    if (!library) {
      library = fetchJson(BASE + 'manifest.json')
        .then(function (manifest) {
          addStylesheet(BASE + manifest.maplibreCss)
          return (window.maplibregl ? Promise.resolve() : loadScript(BASE + manifest.maplibre))
            .then(function () {
              return window.pmtiles ? null : loadScript(BASE + manifest.pmtiles)
            })
            .then(function () {
              return fetchJson(BASE + manifest.style)
            })
            .then(function (style) {
              var protocol = new window.pmtiles.Protocol()
              window.maplibregl.addProtocol('pmtiles', protocol.tile)
              return { maplibregl: window.maplibregl, style: absolutizeStyle(style), bbox: manifest.bbox }
            })
        })
        .catch(function (err) {
          // Сбой не запоминаем: следующая карта на странице попробует заново.
          library = null
          throw err
        })
    }
    return library
  }

  // --- Карта ---

  function setState(view, state) {
    view.root.setAttribute('data-map-state', state)
  }

  function draw(view, lib) {
    return new Promise(function (resolve, reject) {
      var maplibregl = lib.maplibregl
      var options = {
        container: view.root.querySelector('[data-map-canvas]') || view.root,
        // Своя копия на каждую карту: MapLibre дописывает в объект стиля.
        style: JSON.parse(JSON.stringify(lib.style)),
        // Колесо и один палец прокручивают страницу; карту — Ctrl и два пальца.
        cooperativeGestures: true,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        maxZoom: MAX_ZOOM,
        maxBounds: panLimits(lib.bbox, view.points),
        attributionControl: { compact: true },
        locale: pageText(),
      }
      if (view.points.length === 1) {
        options.center = [view.points[0].lng, view.points[0].lat]
        options.zoom = SINGLE_POINT_ZOOM
      } else {
        options.bounds = boundsOf(view.points)
        options.fitBoundsOptions = { padding: FIT_PADDING, maxZoom: FIT_MAX_ZOOM }
      }

      var map = new maplibregl.Map(options)
      view.map = map
      map.touchZoomRotate.disableRotation()
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')

      var icons = readIcons(view.root)
      view.points.forEach(function (point) {
        var el = markerElement(point, icons[point.type])
        point.marker = el
        if (point.kind === 'place') {
          el.querySelector('.project-map-pin').addEventListener('click', function () {
            toggleTip(view, el)
          })
        }
        new maplibregl.Marker({ element: el, anchor: point.kind === 'place' ? 'center' : 'bottom' })
          .setLngLat([point.lng, point.lat])
          .addTo(map)
      })
      applyFilter(view)

      map.on('click', function (event) {
        // Нажатие на метку до карты тоже доходит — подсказку оно не закрывает.
        var target = event && event.originalEvent && event.originalEvent.target
        if (target && target.closest && target.closest('.project-map-marker')) return
        closeTips(view)
      })
      map.on('error', function (event) {
        // Отдельный тайл или шрифт не пришёл — карта при этом живёт.
        console.warn('[map]', event && event.error ? event.error.message : event)
      })

      var timer = setTimeout(function () {
        reject(new Error('карта не отрисовалась за ' + LOAD_TIMEOUT_MS / 1000 + ' с'))
      }, LOAD_TIMEOUT_MS)
      map.once('load', function () {
        clearTimeout(timer)
        resolve()
      })
    })
  }

  function fail(view, err) {
    console.warn('[map] карта не загрузилась, показан список мест:', err && err.message ? err.message : err)
    if (view.map) {
      try {
        view.map.remove()
      } catch (e) {
        // Карта и так сломана — убираем, что получится.
      }
      view.map = null
    }
    view.points.forEach(function (p) {
      p.marker = null
    })
    setState(view, 'failed')
  }

  function start(view) {
    setState(view, 'loading')
    return loadLibrary()
      .then(function (lib) {
        return draw(view, lib)
      })
      .then(function () {
        setState(view, 'ready')
      })
      .catch(function (err) {
        fail(view, err)
      })
  }

  /** Запускает run, когда элемент подъедет к экрану; без IntersectionObserver — сразу. */
  function whenNear(el, run) {
    if (typeof window.IntersectionObserver !== 'function') {
      run()
      return
    }
    var observer = new window.IntersectionObserver(
      function (entries) {
        if (!entries.some(function (e) { return e.isIntersecting })) return
        observer.disconnect()
        run()
      },
      { rootMargin: LAZY_MARGIN }
    )
    observer.observe(el)
  }

  function mount(root) {
    if (root.ghMap) return root.ghMap
    var view = { root: root, points: readPoints(root), hidden: {}, map: null }
    root.ghMap = view
    setupFilter(view)
    if (view.points.length === 0) {
      setState(view, 'empty')
      return view
    }
    setState(view, 'waiting')
    whenNear(root, function () {
      start(view)
    })
    return view
  }

  function init() {
    document.querySelectorAll('[data-map]').forEach(mount)
  }

  // Снаружи: проверка на стенде (scripts/map/check-project-map.js) читает
  // root.ghMap.map, чтобы сверить метки с координатами.
  window.ghProjectMap = { mount: mount }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init)
  else init()
})()
