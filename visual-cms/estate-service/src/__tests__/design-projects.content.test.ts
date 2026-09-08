/**
 * Тексты из «Сайт проекты.xlsx» и их слияние с базовым описанием проектов.
 *
 * Книга — источник истины по копирайту, базовое описание — по медиа и структуре.
 * Проверяем, что побеждает нужная сторона и что ничего не потерялось при разборе.
 */
import { COMPLEXES, GAPS, ComplexSeed } from '../scripts/design-projects.data'
import { PROJECT_CONTENT, EMPTY_SHEETS } from '../scripts/design-projects.content'
import { COMPLEX_TR_FIELDS } from '../services/i18n'

const bySlug = (slug: string): ComplexSeed => {
  const found = COMPLEXES.find((c) => c.slug === slug)
  if (!found) throw new Error('нет проекта ' + slug)
  return found
}

describe('разбор книги', () => {
  it('тексты есть ровно у тех проектов, чьи листы заполнены', () => {
    expect(Object.keys(PROJECT_CONTENT).sort()).toEqual(['assalom-dostlik', 'ozmakon-business'])
  })

  it('пустые листы перечислены явно, а не молча пропущены', () => {
    expect(EMPTY_SHEETS).toContain('Harizma')
    expect(EMPTY_SHEETS).toContain('O`zMahal')
  })

  it('заголовок и текст секции разделены, а не слиплись в одну строку', () => {
    const c = PROJECT_CONTENT['ozmakon-business'].ru
    expect(c.hallTitle).toBe('Дизайнерские холлы')
    expect(c.hallText).not.toContain('Дизайнерские холлы')
    expect(c.hallText!.length).toBeGreaterThan(50)
  })

  it('два абзаца «О проекте» разложены в about и aboutExtra', () => {
    const c = PROJECT_CONTENT['assalom-dostlik'].ru
    expect(c.about).toBeTruthy()
    expect(c.aboutExtra).toBeTruthy()
    expect(c.about).not.toBe(c.aboutExtra)
  })

  it('ключевой параметр разложен на значение и подпись', () => {
    const stats = PROJECT_CONTENT['assalom-dostlik'].ru.stats!
    expect(stats[0]).toEqual({ value: 'Комфорт+', label: 'Класс жилья' })
  })

  it('в текстах не осталось переносов строк — они были разделителями, а не частью копирайта', () => {
    for (const content of Object.values(PROJECT_CONTENT)) {
      for (const value of Object.values(content.ru)) {
        if (typeof value === 'string') expect(value).not.toContain('\n')
      }
    }
  })
})

describe('слияние с базовым описанием', () => {
  it('копирайт берётся из книги', () => {
    for (const [slug, content] of Object.entries(PROJECT_CONTENT)) {
      expect(bySlug(slug).intro).toBe(content.ru.intro)
      expect(bySlug(slug).about).toBe(content.ru.about)
    }
  })

  it('медиа и структура остаются нашими — книга их не трогает', () => {
    const c = bySlug('ozmakon-business')
    expect(c.hallGallery.length).toBeGreaterThan(0)
    expect(c.mapImage).toMatch(/^\/media\//)
    expect(c.address).toContain('Фаргона')
  })

  it('проекты без текстов не получили чужих', () => {
    for (const slug of ['harizma', 'ozmahal', 'ozmakon']) {
      expect(bySlug(slug).hallText).toBe('')
      expect(bySlug(slug).yardFeatures).toEqual([])
    }
  })

  it('пустые листы отмечены в реестре пропусков', () => {
    for (const slug of ['harizma', 'ozmahal']) {
      expect(GAPS.some((g) => g.slug === slug)).toBe(true)
    }
  })
})

describe('узбекские переводы', () => {
  it('приложены к проектам с заполненными листами', () => {
    for (const slug of Object.keys(PROJECT_CONTENT)) {
      expect(bySlug(slug).translations?.uz).toBeDefined()
    }
  })

  it('все переводимые поля есть в реестре COMPLEX_TR_FIELDS — иначе оверлей их не наложит', () => {
    for (const content of Object.values(PROJECT_CONTENT)) {
      for (const field of Object.keys(content.uz)) {
        expect(COMPLEX_TR_FIELDS[field]).toBeDefined()
      }
    }
  })

  it('перевод отличается от русского оригинала', () => {
    for (const [slug, content] of Object.entries(PROJECT_CONTENT)) {
      expect(content.uz.intro).not.toBe(bySlug(slug).intro)
    }
  })

  it('количество ключевых параметров совпадает с русским', () => {
    for (const [slug, content] of Object.entries(PROJECT_CONTENT)) {
      expect(content.uz.stats).toHaveLength(bySlug(slug).stats.length)
    }
  })

  it('удобства двора переведены столько же, сколько заведено', () => {
    const c = PROJECT_CONTENT['ozmakon-business']
    expect(c.uz.yardFeatures).toHaveLength(c.ru.yardFeatures!.length)
  })

  it('у проектов без текстов переводов нет', () => {
    for (const slug of ['harizma', 'ozmahal', 'ozmakon']) {
      expect(bySlug(slug).translations).toBeUndefined()
    }
  })
})
