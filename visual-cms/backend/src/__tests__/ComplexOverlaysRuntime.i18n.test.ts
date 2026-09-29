/**
 * Локализация служебных оверлеев страницы проекта.
 *
 * Оверлеи (лайтбокс галереи и модалка планировки) инжектирует генератор, а не
 * блок структуры. Система переводов их не видит: в `page.structure` этих узлов
 * нет, поэтому на узбекской версии страницы они оставались русскими —
 * «Планировка», «Класс», «Получить консультацию» посреди узбекского текста.
 */
import { generateComplexOverlays, overlayLabels } from '../services/ComplexOverlaysRuntime'

/** Минимальная разметка, включающая обе части оверлеев. */
const BODY =
  '<div class="media-card"></div><div data-carousel-track></div><article class="apartment-card"></article>'

describe('overlayLabels', () => {
  it('отдаёт подписи запрошенного языка', () => {
    expect(overlayLabels('uz').plan).toBe('Reja')
    expect(overlayLabels('en').plan).toBe('Floor plan')
    expect(overlayLabels('ru').plan).toBe('Планировка')
  })

  it('неизвестный язык падает на русский — язык сайта по умолчанию', () => {
    expect(overlayLabels('de').plan).toBe('Планировка')
    expect(overlayLabels(undefined).plan).toBe('Планировка')
    expect(overlayLabels('').plan).toBe('Планировка')
  })

  it('во всех языках заполнены все подписи — пустая строка выглядела бы поломкой', () => {
    for (const lang of ['ru', 'uz', 'en']) {
      for (const [field, value] of Object.entries(overlayLabels(lang))) {
        expect(`${lang}.${field}=${String(value).trim()}`).toMatch(/=\S/)
      }
    }
  })

  it('вместо стоимости — класс проекта: цен на сайте нет', () => {
    expect(overlayLabels('ru').projectClass).toBe('Класс')
    expect(overlayLabels('uz').projectClass).toBe('Sinf')
    expect(overlayLabels('en').projectClass).toBe('Class')
    expect(overlayLabels('ru')).not.toHaveProperty('price')
  })
})

describe('generateComplexOverlays', () => {
  it('без галерей и карточек ничего не инжектит', () => {
    expect(generateComplexOverlays('<div>пусто</div>', 'uz')).toBe('')
  })

  it('на узбекской странице подписи узбекские, кириллицы в разметке нет', () => {
    const out = generateComplexOverlays(BODY, 'uz')
    expect(out).toContain('Reja')
    expect(out).toContain('Maslahat olish')
    expect(out).toContain('Sinf')
    expect(out).not.toContain('Планировка')
    expect(out).not.toContain('Получить консультацию')
    expect(out).not.toContain('</b>Класс<')
    expect(out).toContain('</b>Sinf<')
  })

  it('цены в окне нет ни на одном языке', () => {
    expect(generateComplexOverlays(BODY, 'ru')).not.toContain('Стоимость')
    expect(generateComplexOverlays(BODY, 'uz')).not.toContain('Narx')
    expect(generateComplexOverlays(BODY, 'en')).not.toContain('Price')
  })

  it('без языка остаётся русский — поведение существующих страниц не меняется', () => {
    const out = generateComplexOverlays(BODY)
    expect(out).toContain('Планировка')
    expect(out).toContain('Получить консультацию')
  })

  it('aria-подписи тоже локализованы — их читает скринридер', () => {
    const uz = generateComplexOverlays(BODY, 'uz')
    expect(uz).toContain('aria-label="Yopish"')
    expect(uz).not.toContain('aria-label="Закрыть"')
  })

  it('структура оверлеев не зависит от языка', () => {
    for (const lang of ['ru', 'uz', 'en']) {
      const out = generateComplexOverlays(BODY, lang)
      expect(out).toContain('id="planModal"')
      expect(out).toContain('id="galleryLightbox"')
      expect(out).toContain('id="planModalTitle"')
    }
  })
})
