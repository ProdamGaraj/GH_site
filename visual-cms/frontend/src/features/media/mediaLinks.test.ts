import { describe, it, expect } from 'vitest'
import {
  readFolderFromSearch,
  applyFolderToParams,
  buildFolderLink,
  FOLDER_PARAM,
} from './mediaLinks'
import {
  clampSidebarWidth,
  readSidebarWidth,
  widthAfterDrag,
  SIDEBAR_MIN,
  SIDEBAR_MAX,
  SIDEBAR_DEFAULT,
} from './sidebarWidth'

const BASE = 'https://cms.example/visual_cms/media'

describe('папка в адресе', () => {
  it('без параметра — «Все файлы», а не корень', () => {
    // В медиатеке это разные представления: «все» показывает и вложенные,
    // корень — только файлы без папки.
    expect(readFolderFromSearch('')).toBeNull()
    expect(readFolderFromSearch('?kind=image')).toBeNull()
  })

  it('корень читается особым значением', () => {
    expect(readFolderFromSearch('?folder=root')).toBe('root')
  })

  it('обычная папка — это её id', () => {
    expect(readFolderFromSearch('?folder=9e3adb36-b6a6')).toBe('9e3adb36-b6a6')
  })

  it('пустое значение параметра трактуется как отсутствие', () => {
    expect(readFolderFromSearch('?folder=')).toBeNull()
  })
})

describe('параметры адреса', () => {
  it('папка проставляется', () => {
    const out = applyFolderToParams(new URLSearchParams(), 'abc')
    expect(out.get(FOLDER_PARAM)).toBe('abc')
  })

  it('корень записывается своим значением', () => {
    expect(applyFolderToParams(new URLSearchParams(), 'root').get(FOLDER_PARAM)).toBe('root')
  })

  it('«Все файлы» параметр убирает — ссылка не должна тащить умолчание', () => {
    const out = applyFolderToParams(new URLSearchParams('folder=abc'), null)
    expect(out.has(FOLDER_PARAM)).toBe(false)
  })

  it('чужие параметры не трогаются', () => {
    const out = applyFolderToParams(new URLSearchParams('kind=image&page=3'), 'abc')
    expect(out.get('kind')).toBe('image')
    expect(out.get('page')).toBe('3')
  })

  it('исходный набор не мутируется', () => {
    const src = new URLSearchParams('kind=image')
    applyFolderToParams(src, 'abc')
    expect(src.has(FOLDER_PARAM)).toBe(false)
  })
})

describe('ссылка на папку', () => {
  it('строится от текущего адреса и сохраняет префикс панели', () => {
    // Панель живёт под /visual_cms/ — собирать этот путь заново значило бы
    // завести второй источник правды о том, где смонтировано приложение.
    expect(buildFolderLink(BASE, 'abc')).toBe(`${BASE}?folder=abc`)
  })

  it('заменяет прежнюю папку, а не добавляет вторую', () => {
    expect(buildFolderLink(`${BASE}?folder=old`, 'new')).toBe(`${BASE}?folder=new`)
  })

  it('сохраняет прочие параметры', () => {
    const link = buildFolderLink(`${BASE}?kind=image&folder=old`, 'new')
    expect(link).toContain('kind=image')
    expect(link).toContain('folder=new')
  })

  it('для «Все файлы» отдаёт адрес без параметра', () => {
    expect(buildFolderLink(`${BASE}?folder=abc`, null)).toBe(BASE)
  })

  it('якорь отбрасывается — в ссылке коллеге он ничего не значит', () => {
    expect(buildFolderLink(`${BASE}#section`, 'abc')).toBe(`${BASE}?folder=abc`)
  })

  it('неразбираемый адрес возвращается как есть, а не роняет обработчик', () => {
    expect(buildFolderLink('не адрес', 'abc')).toBe('не адрес')
  })
})

describe('ширина колонки', () => {
  it('держится в границах', () => {
    expect(clampSidebarWidth(10)).toBe(SIDEBAR_MIN)
    expect(clampSidebarWidth(9999)).toBe(SIDEBAR_MAX)
    expect(clampSidebarWidth(300)).toBe(300)
  })

  it('дробные значения округляются', () => {
    expect(clampSidebarWidth(300.6)).toBe(301)
  })

  it('мусор даёт ширину по умолчанию, а не ноль', () => {
    expect(clampSidebarWidth(NaN)).toBe(SIDEBAR_DEFAULT)
    expect(clampSidebarWidth(Infinity)).toBe(SIDEBAR_MAX)
  })

  it('сохранённое значение читается', () => {
    expect(readSidebarWidth('320')).toBe(320)
  })

  it('пустое хранилище даёт умолчание', () => {
    expect(readSidebarWidth(null)).toBe(SIDEBAR_DEFAULT)
    expect(readSidebarWidth('')).toBe(SIDEBAR_DEFAULT)
  })

  it('чужое значение в хранилище не ломает раскладку', () => {
    expect(readSidebarWidth('широкая')).toBe(SIDEBAR_DEFAULT)
    expect(readSidebarWidth('-5')).toBe(SIDEBAR_MIN)
  })
})

describe('перетаскивание', () => {
  it('ширина растёт вслед за курсором', () => {
    expect(widthAfterDrag(200, 500, 560)).toBe(260)
  })

  it('движение назад сужает', () => {
    expect(widthAfterDrag(300, 500, 420)).toBe(220)
  })

  it('возврат курсора в исходную точку возвращает исходную ширину', () => {
    // Считаем от начальных значений, а не от текущих: иначе рывки мышью
    // накапливают ошибку.
    expect(widthAfterDrag(250, 500, 500)).toBe(250)
  })

  it('за границы не уходит', () => {
    expect(widthAfterDrag(200, 500, 0)).toBe(SIDEBAR_MIN)
    expect(widthAfterDrag(200, 500, 5000)).toBe(SIDEBAR_MAX)
  })
})
