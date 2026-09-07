/**
 * Оверлеи страницы проекта, инжектируемые генератором.
 *
 * Ключевое требование: их не должно быть на страницах, где нечего разворачивать,
 * и они не должны попадать в структуру страницы (иначе видны в холсте редактора
 * и их можно случайно удалить).
 */
import { generateComplexOverlays } from '../services/ComplexOverlaysRuntime'

const GALLERY = '<div class="media-card gallery-media" data-carousel="true">'
  + '<div data-carousel-track="true"><div data-carousel-slide="true"></div></div></div>'
const APARTMENTS = '<div class="apartments-grid"><article class="apartment-card"></article></div>'

describe('условия инжекта', () => {
  it('обычная страница без галерей и квартир — ничего не добавляется', () => {
    expect(generateComplexOverlays('<section><h1>О компании</h1></section>')).toBe('')
  })

  it('только галерея — лайтбокс есть, модалки планировки нет', () => {
    const out = generateComplexOverlays(GALLERY)
    expect(out).toContain('id="galleryLightbox"')
    expect(out).not.toContain('id="planModal"')
  })

  it('только квартиры — модалка есть, лайтбокса нет', () => {
    const out = generateComplexOverlays(APARTMENTS)
    expect(out).toContain('id="planModal"')
    expect(out).not.toContain('id="galleryLightbox"')
  })

  it('страница проекта — оба оверлея', () => {
    const out = generateComplexOverlays(GALLERY + APARTMENTS)
    expect(out).toContain('id="galleryLightbox"')
    expect(out).toContain('id="planModal"')
  })

  it('медиа-карточка без карусели не тянет лайтбокс — разворачивать нечего', () => {
    expect(generateComplexOverlays('<div class="media-card"></div>')).toBe('')
  })
})

describe('содержимое', () => {
  const out = generateComplexOverlays(GALLERY + APARTMENTS)

  it('публикует API для скриптов блоков', () => {
    expect(out).toContain('window.ghLightbox')
    expect(out).toContain('window.ghPlanModal')
  })

  it('скрипт ровно один — оверлеи не должны инициализироваться дважды', () => {
    expect(out.match(/<script>/g)).toHaveLength(1)
  })

  it('оверлеи скрыты до открытия: класс is-open ставит только скрипт', () => {
    const markup = out.slice(0, out.indexOf('<script>'))
    expect(markup).toContain('aria-hidden="true"')
    expect(markup).not.toContain('is-open')
  })

  it('элементы, за которые цепляются стили вёрстки, на месте', () => {
    for (const hook of [
      'gallery-lightbox-dialog', 'gallery-lightbox-close', 'gallery-lightbox-image',
      'gallery-lightbox-counter', 'plan-dialog', 'plan-modal-media', 'plan-modal-info',
      'plan-modal-facts', 'plan-modal-cta',
    ]) {
      expect(out).toContain(hook)
    }
  })

  it('идентификаторы, которые читает скрипт, объявлены в разметке', () => {
    for (const id of [
      'galleryLightboxPrev', 'galleryLightboxNext', 'galleryLightboxImage', 'galleryLightboxCounter',
      'planModalPrev', 'planModalNext', 'planModalTitle', 'planModalText',
      'planModalProject', 'planModalPrice', 'planModalFloor', 'planModalDeadline',
    ]) {
      expect(out).toContain('id="' + id + '"')
    }
  })

  it('счётчик и подписи пустые — их заполняет скрипт, а не вёрстка', () => {
    expect(out).toContain('<div class="gallery-lightbox-counter" id="galleryLightboxCounter"></div>')
    expect(out).toContain('<h3 id="planModalTitle"></h3>')
  })

  it('у картинки лайтбокса пустой alt — подпись даёт содержимое, а не рамка', () => {
    expect(out).toContain('alt=""')
  })
})

describe('корректность генерируемого скрипта', () => {
  it('тело скрипта — валидный JS', () => {
    const out = generateComplexOverlays(GALLERY + APARTMENTS)
    const body = out.slice(out.indexOf('<script>') + 8, out.lastIndexOf('</script>'))
    expect(body.length).toBeGreaterThan(100)
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
    expect(() => new Function(body)).not.toThrow()
  })

  it('разметка не содержит незакрытых кавычек в атрибутах', () => {
    const out = generateComplexOverlays(GALLERY + APARTMENTS)
    const markup = out.slice(0, out.indexOf('<script>'))
    const quotes = (markup.match(/"/g) || []).length
    expect(quotes % 2).toBe(0)
  })
})
