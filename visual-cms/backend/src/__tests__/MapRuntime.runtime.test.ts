/**
 * @jest-environment jsdom
 *
 * Рантайм карты проекта в браузере. MapLibre и pmtiles.js подменены
 * поддельными: проверяем то, что решает рантайм, — какие точки взять, какие
 * метки и с какими параметрами создать карту, фильтр легенды, ленивую
 * загрузку и запасной вид при сбое. Что MapLibre рисует верно, проверяет
 * scripts/map/check-project-map.js на стенде.
 */
import * as fs from 'fs'
import * as path from 'path'

const SOURCE = fs.readFileSync(path.join(__dirname, '..', 'services', 'runtime', 'map-runtime.js'), 'utf8')

const MANIFEST = {
  build: '20260925',
  tiles: 'tiles/tashkent-20260925.pmtiles',
  bbox: [69.05, 41.15, 69.55, 41.5],
  maxzoom: 15,
  maplibre: 'lib/maplibre-gl-4.7.1/maplibre-gl.js',
  maplibreCss: 'lib/maplibre-gl-4.7.1/maplibre-gl.css',
  pmtiles: 'lib/pmtiles-4.5.0/pmtiles.js',
  style: 'style.json',
}

const STYLE = {
  version: 8,
  glyphs: '/map/fonts/{fontstack}/{range}.pbf',
  sprite: '/map/sprites/v4/light',
  sources: { protomaps: { type: 'vector', url: 'pmtiles:///map/tiles/tashkent-20260925.pmtiles' } },
  layers: [],
}

interface Point {
  id: string
  kind: 'house' | 'office' | 'place'
  type: string
  name: string
  lat: number | string
  lng: number | string
  color: string
  distance: string
}

const HOUSE: Point = { id: 'house', kind: 'house', type: '', name: 'Doʼstlik', lat: 41.3, lng: 69.28, color: '', distance: '' }
const OFFICE: Point = { id: 'office', kind: 'office', type: '', name: 'Отдел продаж', lat: 41.3, lng: 69.29, color: '', distance: '≈ 840 м' }
const SCHOOL: Point = { id: 'p1', kind: 'place', type: 'school', name: 'Школа №1', lat: 41.301, lng: 69.28, color: '#2f6fdf', distance: '≈ 110 м' }
const PARK: Point = { id: 'p2', kind: 'place', type: 'park', name: 'Парк', lat: 41.302, lng: 69.281, color: '#3f9b4f', distance: '≈ 230 м' }

// --- Поддельные MapLibre и pmtiles ---

interface Fake {
  maps: FakeMap[]
  protocols: string[]
  failOnCreate: boolean
}

let fake: Fake

class FakeMarker {
  lngLat: [number, number] = [0, 0]
  constructor(public options: { element: HTMLElement; anchor: string }) {}
  setLngLat(lngLat: [number, number]): this {
    this.lngLat = lngLat
    return this
  }
  addTo(map: FakeMap): this {
    map.markers.push(this)
    map.options.container.appendChild(this.options.element)
    return this
  }
}

class FakeMap {
  options: any
  handlers: Record<string, Array<(event?: unknown) => void>> = {}
  markers: FakeMarker[] = []
  controls: Array<[any, string]> = []
  removed = false
  touchZoomRotate = { disableRotation: jest.fn() }
  constructor(options: any) {
    if (fake.failOnCreate) throw new Error('Failed to initialize WebGL')
    this.options = options
    fake.maps.push(this)
  }
  addControl(control: unknown, position: string): this {
    this.controls.push([control, position])
    return this
  }
  on(event: string, fn: (event?: unknown) => void): this {
    ;(this.handlers[event] ??= []).push(fn)
    return this
  }
  once(event: string, fn: (event?: unknown) => void): this {
    return this.on(event, fn)
  }
  fire(event: string, data?: unknown): void {
    for (const fn of this.handlers[event] ?? []) fn(data)
  }
  remove(): void {
    this.removed = true
  }
  marker(id: string): HTMLElement {
    const found = this.markers.find((m) => m.options.element.getAttribute('data-map-marker') === id)
    if (!found) throw new Error(`нет метки ${id}`)
    return found.options.element
  }
}

function installLibrary(): void {
  fake = { maps: [], protocols: [], failOnCreate: false }
  ;(window as any).maplibregl = {
    Map: FakeMap,
    Marker: FakeMarker,
    NavigationControl: class {
      constructor(public options: unknown) {}
    },
    addProtocol: (name: string) => fake.protocols.push(name),
  }
  ;(window as any).pmtiles = {
    Protocol: class {
      tile = (): void => undefined
    },
  }
}

/** fetch: /map/manifest.json и /map/style.json; число вместо тела — HTTP-ошибка. */
function mockFetch(overrides: Record<string, unknown> = {}): jest.Mock {
  const bodies: Record<string, unknown> = { '/map/manifest.json': MANIFEST, '/map/style.json': STYLE, ...overrides }
  const fetch = jest.fn(async (url: string) => {
    const body = url in bodies ? bodies[url] : 404
    if (typeof body === 'number') return { ok: false, status: body, json: async () => ({}) }
    return { ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(body)) }
  })
  ;(window as any).fetch = fetch
  return fetch
}

// --- Разметка ---

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')

function pointHtml(p: Point): string {
  return (
    `<li data-map-point="" data-id="${p.id}" data-kind="${p.kind}" data-type="${p.type}" data-lat="${p.lat}"` +
    ` data-lng="${p.lng}" data-color="${p.color}" data-distance="${esc(p.distance)}">` +
    `<span data-map-point-name="">${esc(p.name)}</span><span>${esc(p.distance)}</span></li>`
  )
}

function mapHtml(points: Point[], legend: string[] = ['school', 'park']): string {
  const buttons = legend
    .map((type) => `<button type="button" data-map-filter="${type}"><span data-map-icon=""><svg viewBox="0 0 24 24"><path d="M${type.length} 1"/></svg></span>${type}</button>`)
    .join('')
  return (
    `<div class="project-map" data-map=""><div data-map-canvas=""></div>` +
    `<div data-map-legend="">${buttons}</div><ul>${points.map(pointHtml).join('')}</ul></div>`
  )
}

function page(points: Point[], legend?: string[]): HTMLElement {
  document.body.innerHTML = mapHtml(points, legend)
  return document.querySelector('[data-map]') as HTMLElement
}

function run(): void {
  // eslint-disable-next-line no-new-func
  new Function(SOURCE)()
}

/** Даёт отработать цепочке промисов рантайма (fetch и загрузка поддельные). */
async function flush(): Promise<void> {
  for (let i = 0; i < 20; i++) await Promise.resolve()
}

const state = (root: Element): string | null => root.getAttribute('data-map-state')
const item = (id: string): HTMLElement => document.querySelector(`[data-map-point][data-id="${id}"]`) as HTMLElement
const filter = (type: string): HTMLElement => document.querySelector(`[data-map-filter="${type}"]`) as HTMLElement

let warn: jest.SpyInstance

beforeEach(() => {
  document.documentElement.lang = 'ru'
  installLibrary()
  warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
})

afterEach(() => {
  jest.useRealTimers()
  warn.mockRestore()
  document.body.innerHTML = ''
  document.head.innerHTML = ''
  for (const key of ['ghProjectMap', 'maplibregl', 'pmtiles', 'fetch', 'IntersectionObserver']) delete (window as any)[key]
})

describe('точки из разметки', () => {
  it('без точек карта пустая, и библиотека не грузится', () => {
    const fetch = mockFetch()
    const root = page([])
    run()
    expect(state(root)).toBe('empty')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('точка без координат или за пределами пропускается, остальные остаются', async () => {
    mockFetch()
    page([HOUSE, { ...SCHOOL, lat: '' }, { ...PARK, id: 'bad', lat: 95 }, { ...PARK, lng: 'abc' }])
    run()
    await flush()
    expect(fake.maps[0].markers.map((m) => m.options.element.getAttribute('data-map-marker'))).toEqual(['house'])
  })
})

describe('ленивая загрузка', () => {
  it('библиотека грузится, только когда карта подъезжает к экрану', async () => {
    const fetch = mockFetch()
    let notify: (entries: Array<{ isIntersecting: boolean }>) => void = () => undefined
    const observer = { observe: jest.fn(), disconnect: jest.fn(), options: undefined as unknown }
    ;(window as any).IntersectionObserver = function (callback: typeof notify, options: unknown) {
      notify = callback
      observer.options = options
      return observer
    }
    const root = page([HOUSE, SCHOOL])
    run()
    expect(state(root)).toBe('waiting')
    expect(observer.observe).toHaveBeenCalledWith(root)
    expect(observer.options).toEqual({ rootMargin: '600px 0px' })

    notify([{ isIntersecting: false }])
    await flush()
    expect(fetch).not.toHaveBeenCalled()

    notify([{ isIntersecting: true }])
    await flush()
    expect(observer.disconnect).toHaveBeenCalled()
    expect(fetch).toHaveBeenCalledWith('/map/manifest.json', { credentials: 'same-origin' })
    expect(fake.maps).toHaveLength(1)
  })
})

describe('карта', () => {
  it('стиль с полными адресами, жесты двумя пальцами, подписи на языке страницы', async () => {
    const fetch = mockFetch()
    const root = page([HOUSE, OFFICE, SCHOOL, PARK])
    run()
    await flush()

    expect(fetch.mock.calls.map((c) => c[0])).toEqual(['/map/manifest.json', '/map/style.json'])
    const link = document.head.querySelector('link[data-map-css]') as HTMLLinkElement
    expect(link.getAttribute('href')).toBe('/map/lib/maplibre-gl-4.7.1/maplibre-gl.css')
    expect(fake.protocols).toEqual(['pmtiles'])

    const { options } = fake.maps[0]
    expect(options.container).toBe(root.querySelector('[data-map-canvas]'))
    expect(options.style.glyphs).toBe('http://localhost/map/fonts/{fontstack}/{range}.pbf')
    expect(options.style.sprite).toBe('http://localhost/map/sprites/v4/light')
    expect(options.style.sources.protomaps.url).toBe('pmtiles://http://localhost/map/tiles/tashkent-20260925.pmtiles')
    expect(options).toMatchObject({ cooperativeGestures: true, dragRotate: false, touchPitch: false })
    expect(options.locale['CooperativeGesturesHandler.MobileHelpText']).toBe('Двигайте карту двумя пальцами')
    expect(fake.maps[0].touchZoomRotate.disableRotation).toHaveBeenCalled()
    expect(fake.maps[0].controls[0][1]).toBe('top-right')
    expect(fake.maps[0].controls[0][0].options).toEqual({ showCompass: false })
  })

  it('все точки в кадре; двигать можно в пределах тайлов с запасом', async () => {
    mockFetch()
    page([HOUSE, OFFICE, SCHOOL, PARK])
    run()
    await flush()
    const { options } = fake.maps[0]
    expect(options.bounds).toEqual([
      [69.28, 41.3],
      [69.29, 41.302],
    ])
    expect(options.fitBoundsOptions).toEqual({ padding: { top: 110, right: 100, bottom: 30, left: 100 }, maxZoom: 16 })
    expect(options.maxBounds[0][0]).toBeCloseTo(69.0)
    expect(options.maxBounds[0][1]).toBeCloseTo(41.1)
    expect(options.maxBounds[1][0]).toBeCloseTo(69.6)
    expect(options.maxBounds[1][1]).toBeCloseTo(41.55)
    expect(options.center).toBeUndefined()
  })

  it('точка за рамкой тайлов расширяет пределы, иначе её не показать', async () => {
    mockFetch()
    page([HOUSE, { ...PARK, lng: 70.1 }])
    run()
    await flush()
    expect(fake.maps[0].options.maxBounds[1][0]).toBeCloseTo(70.15)
  })

  it('одна точка — по центру, масштаб 15', async () => {
    mockFetch()
    page([HOUSE], [])
    run()
    await flush()
    expect(fake.maps[0].options).toMatchObject({ center: [69.28, 41.3], zoom: 15 })
    expect(fake.maps[0].options.bounds).toBeUndefined()
  })

  it('готова после первой отрисовки', async () => {
    mockFetch()
    const root = page([HOUSE, SCHOOL])
    run()
    await flush()
    expect(state(root)).toBe('loading')
    fake.maps[0].fire('load')
    await flush()
    expect(state(root)).toBe('ready')
  })

  it('язык страницы: uz и en; незнакомый — ru', async () => {
    mockFetch()
    const texts: string[] = []
    for (const lang of ['uz', 'en', 'kk']) {
      document.documentElement.lang = lang
      const root = document.createElement('div')
      root.innerHTML = mapHtml([HOUSE])
      document.body.appendChild(root)
      if (!(window as any).ghProjectMap) run()
      else (window as any).ghProjectMap.mount(root.firstElementChild)
      await flush()
      texts.push(fake.maps[fake.maps.length - 1].options.locale['CooperativeGesturesHandler.MobileHelpText'])
    }
    expect(texts).toEqual(['Xaritani ikki barmoq bilan suring', 'Use two fingers to move the map', 'Двигайте карту двумя пальцами'])
  })

  it('две карты на странице — манифест, стиль и протокол один раз', async () => {
    const fetch = mockFetch()
    document.body.innerHTML = mapHtml([HOUSE]) + mapHtml([HOUSE, SCHOOL])
    run()
    await flush()
    expect(fake.maps).toHaveLength(2)
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(fake.protocols).toEqual(['pmtiles'])
    expect(document.head.querySelectorAll('link[data-map-css]')).toHaveLength(1)
  })

  it('скрипт на странице дважды — карта одна', async () => {
    mockFetch()
    const root = page([HOUSE])
    run()
    run()
    await flush()
    expect(fake.maps).toHaveLength(1)
    expect((window as any).ghProjectMap.mount(root)).toBe((root as any).ghMap)
  })
})

describe('метки', () => {
  it('дом и отдел продаж подписаны и стоят остриём на точке; место — кнопка с иконкой и цветом типа', async () => {
    mockFetch()
    page([HOUSE, OFFICE, SCHOOL])
    run()
    await flush()
    const map = fake.maps[0]
    expect(map.markers.map((m) => [m.options.element.getAttribute('data-map-marker'), m.options.anchor, m.lngLat])).toEqual([
      ['house', 'bottom', [69.28, 41.3]],
      ['office', 'bottom', [69.29, 41.3]],
      ['p1', 'center', [69.28, 41.301]],
    ])

    const house = map.marker('house')
    expect(house.className).toBe('project-map-marker project-map-marker--house')
    expect(house.textContent).toBe('Doʼstlik')
    expect(house.querySelector('button')).toBeNull()
    expect(map.marker('office').querySelector('[role="img"]')!.getAttribute('aria-label')).toBe('Отдел продаж, ≈ 840 м')

    const pin = map.marker('p1').querySelector('button.project-map-pin') as HTMLButtonElement
    expect(pin.getAttribute('aria-label')).toBe('Школа №1, ≈ 110 м')
    expect(pin.style.getPropertyValue('--map-color')).toBe('#2f6fdf')
    expect(pin.querySelector('svg path')!.getAttribute('d')).toBe('M6 1')
    expect(map.marker('p1').querySelector('.project-map-tip')!.textContent).toBe('Школа №1≈ 110 м')
    // Иконка скопирована, а не перенесена: в легенде она осталась.
    expect(filter('school').querySelector('svg')).not.toBeNull()
  })

  it('название попадает в метку текстом, а не разметкой', async () => {
    mockFetch()
    page([HOUSE, { ...SCHOOL, name: '<img src=x onerror="alert(1)">' }])
    run()
    await flush()
    const marker = fake.maps[0].marker('p1')
    expect(marker.querySelector('img')).toBeNull()
    expect(marker.querySelector('.project-map-tip-name')!.textContent).toBe('<img src=x onerror="alert(1)">')
  })

  it('места без иконки в легенде — метка без иконки, но есть', async () => {
    mockFetch()
    page([HOUSE, SCHOOL], [])
    run()
    await flush()
    const pin = fake.maps[0].marker('p1').querySelector('.project-map-pin')!
    expect(pin.querySelector('svg')).toBeNull()
  })

  it('подсказка: нажатие открывает, открыта одна; клик по карте закрывает, по метке — нет', async () => {
    mockFetch()
    page([HOUSE, SCHOOL, PARK])
    run()
    await flush()
    const map = fake.maps[0]
    const school = map.marker('p1')
    const park = map.marker('p2')
    ;(school.querySelector('button') as HTMLElement).click()
    expect(school.classList.contains('is-open')).toBe(true)
    expect(school.style.zIndex).toBe('3')

    ;(park.querySelector('button') as HTMLElement).click()
    expect(school.classList.contains('is-open')).toBe(false)
    expect(school.style.zIndex).toBe('')
    expect(park.classList.contains('is-open')).toBe(true)

    map.fire('click', { originalEvent: { target: park.querySelector('button') } })
    expect(park.classList.contains('is-open')).toBe(true)
    map.fire('click', { originalEvent: { target: map.options.container } })
    expect(park.classList.contains('is-open')).toBe(false)

    ;(park.querySelector('button') as HTMLElement).click()
    ;(park.querySelector('button') as HTMLElement).click()
    expect(park.classList.contains('is-open')).toBe(false)
  })
})

describe('легенда', () => {
  it('кнопка прячет места своего типа — и метки, и строки списка; дом и офис не трогает', async () => {
    mockFetch()
    page([HOUSE, OFFICE, SCHOOL, PARK])
    run()
    await flush()
    const map = fake.maps[0]
    expect(filter('school').getAttribute('aria-pressed')).toBe('true')

    filter('school').click()
    expect(filter('school').getAttribute('aria-pressed')).toBe('false')
    expect(map.marker('p1').hidden).toBe(true)
    expect(item('p1').hidden).toBe(true)
    expect(map.marker('p2').hidden).toBe(false)
    expect(map.marker('house').hidden).toBe(false)
    expect(map.marker('office').hidden).toBe(false)

    filter('school').click()
    expect(filter('school').getAttribute('aria-pressed')).toBe('true')
    expect(map.marker('p1').hidden).toBe(false)
    expect(item('p1').hidden).toBe(false)
  })

  it('скрытие типа закрывает открытую подсказку', async () => {
    mockFetch()
    page([HOUSE, SCHOOL])
    run()
    await flush()
    const school = fake.maps[0].marker('p1')
    ;(school.querySelector('button') as HTMLElement).click()
    filter('school').click()
    expect(school.classList.contains('is-open')).toBe(false)
  })

  it('тип спрятан до загрузки карты — его метки появляются уже спрятанными', async () => {
    mockFetch()
    let notify: (entries: Array<{ isIntersecting: boolean }>) => void = () => undefined
    ;(window as any).IntersectionObserver = function (callback: typeof notify) {
      notify = callback
      return { observe: () => undefined, disconnect: () => undefined }
    }
    page([HOUSE, SCHOOL, PARK])
    run()
    filter('park').click()
    expect(item('p2').hidden).toBe(true)
    notify([{ isIntersecting: true }])
    await flush()
    expect(fake.maps[0].marker('p2').hidden).toBe(true)
    expect(fake.maps[0].marker('p1').hidden).toBe(false)
  })
})

describe('сбой — список мест вместо карты', () => {
  it('нет описания сборки карты (/map/ не собран)', async () => {
    mockFetch({ '/map/manifest.json': 404 })
    const root = page([HOUSE, SCHOOL])
    run()
    await flush()
    expect(state(root)).toBe('failed')
    expect(fake.maps).toHaveLength(0)
    expect(warn).toHaveBeenCalled()
  })

  it('нет стиля', async () => {
    mockFetch({ '/map/style.json': 500 })
    const root = page([HOUSE, SCHOOL])
    run()
    await flush()
    expect(state(root)).toBe('failed')
  })

  it('браузер не поднял WebGL', async () => {
    mockFetch()
    fake.failOnCreate = true
    const root = page([HOUSE, SCHOOL])
    run()
    await flush()
    expect(state(root)).toBe('failed')
  })

  it('карта не отрисовалась за 20 секунд — убирается', async () => {
    jest.useFakeTimers()
    mockFetch()
    const root = page([HOUSE, SCHOOL])
    run()
    await flush()
    const map = fake.maps[0]
    await jest.advanceTimersByTimeAsync(19999)
    expect(state(root)).toBe('loading')
    await jest.advanceTimersByTimeAsync(1)
    expect(state(root)).toBe('failed')
    expect(map.removed).toBe(true)
  })

  it('ошибка отдельного тайла после отрисовки карту не роняет', async () => {
    mockFetch()
    const root = page([HOUSE, SCHOOL])
    run()
    await flush()
    fake.maps[0].fire('load')
    fake.maps[0].fire('error', { error: new Error('tile 404') })
    await flush()
    expect(state(root)).toBe('ready')
    expect(fake.maps[0].removed).toBe(false)
  })

  it('сбой не запоминается: следующая карта пробует загрузиться заново', async () => {
    const fetch = mockFetch({ '/map/manifest.json': 503 })
    const first = page([HOUSE])
    run()
    await flush()
    expect(state(first)).toBe('failed')

    mockFetch()
    const second = document.createElement('div')
    second.innerHTML = mapHtml([HOUSE])
    document.body.appendChild(second)
    ;(window as any).ghProjectMap.mount(second.firstElementChild)
    await flush()
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fake.maps).toHaveLength(1)
    expect(state(second.firstElementChild as Element)).toBe('loading')
  })
})
