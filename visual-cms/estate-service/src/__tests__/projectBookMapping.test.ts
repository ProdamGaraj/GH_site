/**
 * Разбор книги «Сайт проекты.xlsx».
 *
 * Фикстуры повторяют реальные неровности файла заказчика, а не идеальную
 * таблицу: смесь настоящих переносов с литеральными «\n», заголовок секции то
 * есть, то нет, строки одного бокса без повтора его имени, дублирующая пустая
 * строка «Заявки». Каждая из них однажды дала бы молчаливо неверный текст на
 * витрине.
 */
import {
  normalizeCell,
  looksLikeTitle,
  splitSection,
  parseStat,
  groupByBox,
  locateColumns,
  rowsFromGrid,
  mapSheet,
  mapBookSheet,
  isEmptyContent,
  BookRow,
  SheetGrid,
} from '../scripts/projectBookMapping'

const row = (box: string, ru: string, uz = ''): BookRow => ({ box, ru, uz })

describe('locateColumns / rowsFromGrid', () => {
  // Раскладка листов «Assalom Do`stlik», «Harizma», «O`zMahal».
  const narrow: SheetGrid = [
    [],
    ['', '№', 'Бокс', 'Текст', 'Текст Уз', 'Материал'],
    ['', '1', 'Header', 'Вступление', 'Kirish', 'ссылка'],
  ]
  // Раскладка листа «O`zMakon Buisness»: шапка ниже, колонки правее,
  // русский столбец озаглавлен «Текст Ру».
  const wide: SheetGrid = [
    [],
    [],
    [],
    [],
    ['', '', '', '', '№', 'Бокс', 'Текст Ру', 'Текст Уз', 'Материал'],
    ['', '', '', '', '1', 'Header', 'Вступление', 'Kirish', 'ссылка'],
  ]

  it('узкая раскладка: шапка на второй строке, колонки со второй', () => {
    expect(locateColumns(narrow)).toEqual({ headerRow: 1, box: 2, ru: 3, uz: 4 })
  })

  it('широкая раскладка с заголовком «Текст Ру» — та же книга, другой лист', () => {
    expect(locateColumns(wide)).toEqual({ headerRow: 4, box: 5, ru: 6, uz: 7 })
  })

  it('обе раскладки дают одинаковые строки', () => {
    expect(rowsFromGrid(narrow)).toEqual([row('Header', 'Вступление', 'Kirish')])
    expect(rowsFromGrid(wide)).toEqual([row('Header', 'Вступление', 'Kirish')])
  })

  it('регистр и лишние пробелы в шапке не мешают', () => {
    const messy: SheetGrid = [['  БОКС ', 'Текст', 'ТЕКСТ УЗ'], ['Header', 'Ру', 'Уз']]
    expect(locateColumns(messy)).toEqual({ headerRow: 0, box: 0, ru: 1, uz: 2 })
  })

  it('лист без узнаваемой шапки не выдумывает колонки', () => {
    expect(locateColumns([['a', 'b'], ['c', 'd']])).toBeNull()
    expect(rowsFromGrid([['a', 'b']])).toEqual([])
  })

  it('лист без колонки перевода читается, оверлей пуст', () => {
    const noUz: SheetGrid = [['Бокс', 'Текст'], ['Header', 'Только ру']]
    expect(locateColumns(noUz)).toEqual({ headerRow: 0, box: 0, ru: 1, uz: -1 })
    expect(rowsFromGrid(noUz)).toEqual([row('Header', 'Только ру', '')])
  })
})

describe('normalizeCell', () => {
  it('литеральный «\\n» становится переводом строки', () => {
    expect(normalizeCell('Подберем квартиру\\nОставьте контакты')).toBe(
      'Подберем квартиру\nОставьте контакты'
    )
  })

  it('настоящие переносы и литеральные в одной ячейке — как в «О проекте» у O`zMahal', () => {
    expect(normalizeCell('О проекте\nПервый абзац.\\n\\nВторой абзац.')).toBe(
      'О проекте\nПервый абзац.\n\nВторой абзац.'
    )
  })

  it('CRLF, лишние пустые строки и краевые пробелы убираются', () => {
    expect(normalizeCell('  Заголовок \r\n\n\n\n  Текст  \r\n')).toBe('Заголовок\n\nТекст')
  })

  it('пустое и отсутствующее значение дают пустую строку', () => {
    expect(normalizeCell('')).toBe('')
    expect(normalizeCell(undefined)).toBe('')
    expect(normalizeCell(null)).toBe('')
  })
})

describe('looksLikeTitle', () => {
  it('короткая строка без знака конца предложения — заголовок', () => {
    expect(looksLikeTitle('О проекте', ['текст'])).toBe(true)
    expect(looksLikeTitle('В центре активной жизни', ['текст'])).toBe(true)
  })

  it('строка с точкой на конце — уже текст', () => {
    expect(looksLikeTitle('Harizma — жилой квартал.', ['ещё'])).toBe(false)
  })

  it('длинная строка — текст, даже без точки', () => {
    expect(looksLikeTitle('a'.repeat(61), ['ещё'])).toBe(false)
  })

  it('единственная строка заголовком не считается — иначе секция осталась бы без текста', () => {
    expect(looksLikeTitle('О проекте', [])).toBe(false)
  })
})

describe('splitSection', () => {
  it('заголовок в ячейке побеждает имя бокса', () => {
    expect(splitSection('Дворовое пространство\nТекст двора.', 'Благоустройство')).toEqual({
      title: 'Дворовое пространство',
      body: ['Текст двора.'],
    })
  })

  it('без заголовка в ячейке берётся имя бокса — это тоже текст заказчика', () => {
    // Случай Harizma: «О проекте» начинается сразу с абзаца.
    expect(splitSection('Harizma — жилой квартал.\nВторой абзац.', 'О проекте')).toEqual({
      title: 'О проекте',
      body: ['Harizma — жилой квартал.', 'Второй абзац.'],
    })
  })

  it('пустая ячейка не выдумывает текст', () => {
    expect(splitSection('', 'О проекте')).toEqual({ title: 'О проекте', body: [] })
  })
})

describe('parseStat', () => {
  it('значение и подпись лежат в одной ячейке двумя строками', () => {
    expect(parseStat('Бизнес\nКласс жилья')).toEqual({ value: 'Бизнес', label: 'Класс жилья' })
    expect(parseStat('12–16\nЭтажей')).toEqual({ value: '12–16', label: 'Этажей' })
  })

  it('подпись из нескольких строк склеивается', () => {
    expect(parseStat('Готовая отделка\nКвартиры\nс ремонтом')).toEqual({
      value: 'Готовая отделка',
      label: 'Квартиры с ремонтом',
    })
  })

  it('одна строка — значение без подписи', () => {
    expect(parseStat('Бизнес')).toEqual({ value: 'Бизнес', label: '' })
  })

  it('пустая ячейка отбрасывается', () => {
    expect(parseStat('')).toBeNull()
  })
})

describe('groupByBox', () => {
  it('строки без имени бокса продолжают предыдущий', () => {
    const boxes = groupByBox([
      row('Основные пункты', 'Бизнес\nКласс'),
      row('', '12–16\nЭтажей'),
      row('', '3 м\nПотолки'),
      row('О проекте', 'Текст'),
    ])
    expect(boxes.map((b) => b.name)).toEqual(['Основные пункты', 'О проекте'])
    expect(boxes[0].rows).toHaveLength(3)
  })

  it('повтор имени подряд не создаёт второй бокс — в книге «Заявка» продублирована', () => {
    const boxes = groupByBox([row('Заявка', 'Текст'), row('Заявка', '')])
    expect(boxes).toHaveLength(1)
    expect(boxes[0].rows).toHaveLength(2)
  })

  it('строки до первого бокса (шапка таблицы) отбрасываются', () => {
    expect(groupByBox([row('', '№'), row('Header', 'Вступление')])).toEqual([
      { name: 'Header', rows: [row('Header', 'Вступление')] },
    ])
  })

  it('пустой лист — пустой результат', () => {
    expect(groupByBox([])).toEqual([])
  })
})

// Срез реального листа Harizma, включая его особенности.
const HARIZMA: BookRow[] = [
  row('', '№', 'Текст Уз'),
  row('Header', 'Жилой квартал бизнес-класса Golden House', 'Golden House biznes-klass turar joy kvartali'),
  row('Основные пункты', 'Бизнес\nКласс жилья', 'Biznes\nTurar joy toifasi'),
  row('', '12–16\nЭтажей', '12–16\nQavat'),
  row('', '3 м\nВысота потолков', '3 m\nShift balandligi'),
  row(
    'О проекте',
    'Harizma — жилой квартал бизнес-класса от Golden House, созданный как зелёное пространство.\nКвартиры передаются с готовой отделкой.',
    'Harizma — Golden House tomonidan yaratilgan biznes-klass turar joy kvartali.\nXonadonlar tayyor ta’mirlangan holda topshiriladi.'
  ),
  row(
    'Благоустройство',
    'Дворовое пространство\nHarizma создан как жилой квартал без машин.',
    'Hovli maydoni\nHarizma avtomobillarsiz turar joy kvartali sifatida yaratilgan.'
  ),
  row('УТП', 'Территория без машин', 'Avtomobillarsiz hudud'),
  row('', 'Прогулочный бульвар', 'Sayr xiyoboni'),
  row('', 'BBQ-зоны', 'BBQ zonalari'),
  row(
    'Дизайнерские холлы',
    'Дизайнерские холлы\nСовременные входные группы продолжают концепцию.',
    'Dizaynerlik xollari\nZamonaviy kirish guruhlari konsepsiyani davom ettiradi.'
  ),
  row('Выборка', '', ''),
  row(
    'Карта',
    'В центре активной жизни\nHarizma расположен в Яшнабадском районе Ташкента.',
    'Faol hayot markazida\nHarizma Toshkentning Yashnobod tumanida joylashgan.'
  ),
  row('Заявка', 'Подберем квартиру в Harizma\\nОставьте контакты.', 'Harizma’da xonadon tanlab beramiz\\nKontaktlaringizni qoldiring.'),
  row('Заявка', '', ''),
]

describe('mapSheet — русский', () => {
  const ru = mapSheet(HARIZMA, 'ru')

  it('Header становится вступлением', () => {
    expect(ru.intro).toBe('Жилой квартал бизнес-класса Golden House')
  })

  it('«Основные пункты» собираются в stats по всем строкам бокса', () => {
    expect(ru.stats).toEqual([
      { value: 'Бизнес', label: 'Класс жилья' },
      { value: '12–16', label: 'Этажей' },
      { value: '3 м', label: 'Высота потолков' },
    ])
  })

  it('«О проекте» без заголовка в ячейке: заголовок из имени бокса, абзацы разделены', () => {
    expect(ru.aboutTitle).toBe('О проекте')
    expect(ru.about).toBe(
      'Harizma — жилой квартал бизнес-класса от Golden House, созданный как зелёное пространство.'
    )
    expect(ru.aboutExtra).toBe('Квартиры передаются с готовой отделкой.')
  })

  it('«Благоустройство» берёт заголовок из ячейки', () => {
    expect(ru.yardTitle).toBe('Дворовое пространство')
    expect(ru.yardText).toBe('Harizma создан как жилой квартал без машин.')
  })

  it('«УТП» становится списком преимуществ двора', () => {
    expect(ru.yardFeatures).toEqual(['Территория без машин', 'Прогулочный бульвар', 'BBQ-зоны'])
  })

  it('холлы и карта разбираются на заголовок и текст', () => {
    expect(ru.hallTitle).toBe('Дизайнерские холлы')
    expect(ru.hallText).toBe('Современные входные группы продолжают концепцию.')
    expect(ru.locationTitle).toBe('В центре активной жизни')
    expect(ru.locationText).toBe('Harizma расположен в Яшнабадском районе Ташкента.')
  })

  it('боксы «Выборка» и «Заявка» не дают полей — им нет места в ProjectTexts', () => {
    expect(Object.keys(ru).sort()).toEqual(
      [
        'about',
        'aboutExtra',
        'aboutTitle',
        'hallText',
        'hallTitle',
        'intro',
        'locationText',
        'locationTitle',
        'stats',
        'yardFeatures',
        'yardText',
        'yardTitle',
      ].sort()
    )
  })
})

describe('mapSheet — узбекский оверлей', () => {
  const uz = mapSheet(HARIZMA, 'uz')

  it('переводы разбираются теми же правилами', () => {
    expect(uz.intro).toBe('Golden House biznes-klass turar joy kvartali')
    expect(uz.yardTitle).toBe('Hovli maydoni')
    expect(uz.yardFeatures).toEqual(['Avtomobillarsiz hudud', 'Sayr xiyoboni', 'BBQ zonalari'])
    expect(uz.stats).toEqual([
      { value: 'Biznes', label: 'Turar joy toifasi' },
      { value: '12–16', label: 'Qavat' },
      { value: '3 m', label: 'Shift balandligi' },
    ])
  })

  it('запасной заголовок из имени бокса в оверлей НЕ попадает — иначе на uz показался бы русский', () => {
    // В ячейке uz заголовка «О проекте» нет, как и в ru.
    expect(uz.aboutTitle).toBeUndefined()
    expect(uz.about).toBe('Harizma — Golden House tomonidan yaratilgan biznes-klass turar joy kvartali.')
  })

  it('заголовок, который в ячейке есть, переводится', () => {
    expect(uz.hallTitle).toBe('Dizaynerlik xollari')
    expect(uz.locationTitle).toBe('Faol hayot markazida')
  })
})

describe('mapBookSheet', () => {
  it('отдаёт пару ru/uz', () => {
    const content = mapBookSheet(HARIZMA)
    expect(content.ru.intro).toBeDefined()
    expect(content.uz.intro).toBeDefined()
    expect(isEmptyContent(content)).toBe(false)
  })

  it('пустой лист виден как пустой — по нему нечего заполнять', () => {
    const content = mapBookSheet([row('', '№'), row('Выборка', ''), row('Заявка', '')])
    expect(isEmptyContent(content)).toBe(true)
  })

  it('лист без узбекской колонки не ломается: оверлей пуст, фолбэк на ru', () => {
    const content = mapBookSheet([row('Header', 'Только русский')])
    expect(content.ru.intro).toBe('Только русский')
    expect(content.uz.intro).toBeUndefined()
  })
})
