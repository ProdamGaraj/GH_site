/**
 * Ввод админки: чистка HTML до базы, переводы только живых секций, правило
 * «язык отмечается только при полном переводе».
 */
import {
  blockedNewLocales,
  localeStates,
  normalizeSections,
  translationRows,
  translationsForAdmin,
} from '../services/newsInput'
import { S1, S2, newsRow, section } from './helpers/newsFixtures'

describe('normalizeSections', () => {
  it('HTML чистится, сторона по умолчанию — справа, повтор id отбрасывается', () => {
    const out = normalizeSections([
      { id: S1, type: 'text', html: '<p onclick="x">Текст</p><script>1</script>', media: [], side: 'right' },
      { id: S2, type: 'photoText', html: '<b>Фото</b>', media: ['/a.webp'], side: 'left' },
      { id: S1, type: 'text', html: '<p>дубль</p>', media: [], side: 'right' },
    ])
    expect(out).toEqual([
      { id: S1, type: 'text', html: '<p>Текст</p>', media: [], side: 'right' },
      { id: S2, type: 'photoText', html: '<strong>Фото</strong>', media: ['/a.webp'], side: 'left' },
    ])
  })

  it('пустой HTML — пустая строка', () => {
    expect(normalizeSections([{ id: S1, type: 'text', media: [], side: 'right' }])[0].html).toBe('')
  })
})

describe('translationRows / translationsForAdmin', () => {
  const sections = [section(S1), section(S2)]

  it('строки по языкам; HTML переводов чистится; перевод удалённой секции и пустые — отбрасываются', () => {
    const rows = translationRows(
      'n1',
      {
        uz: { title: ' Sarlavha ', lead: '', sections: { [S1]: '<p>Matn<script>x</script></p>', [S2]: '<p></p>', 'dead0000-0000-4000-8000-000000000000': '<p>old</p>' } },
        en: { title: '' },
      },
      sections
    )
    expect(rows).toEqual([
      { newsId: 'n1', locale: 'uz', field: 'title', value: 'Sarlavha' },
      { newsId: 'n1', locale: 'uz', field: 'sections', value: JSON.stringify({ [S1]: { html: '<p>Matn</p>' }, [S2]: { html: '<p></p>' } }) },
    ])
  })

  it('без переводов — пусто', () => {
    expect(translationRows('n1', undefined, sections)).toEqual([])
  })

  it('из базы в форму админки и обратно — без потерь', () => {
    const input = { uz: { title: 'T', lead: 'L', sections: { [S1]: '<p>a</p>' }, blocks: {} }, en: { title: 'E', lead: '', sections: {}, blocks: {} } }
    const rows = translationRows('n1', input, sections)
    expect(translationsForAdmin(rows)).toEqual(input)
  })

  it('битый json секций в базе — как будто перевода секций нет', () => {
    expect(translationsForAdmin([{ newsId: 'n1', locale: 'uz', field: 'sections', value: '{oops' }]).uz.sections).toEqual({})
  })
})

describe('отметка языка', () => {
  it('новая отметка при неполном переводе — блок с перечнем недостающего', () => {
    const news = newsRow({ publishOn: ['uz', 'en'], sections: [section(S1), section(S2)] })
    const rows = translationRows(news.id, { uz: { title: 'T', lead: 'L', sections: { [S1]: '<p>a</p>' } } }, news.sections)
    expect(blockedNewLocales([], news, rows)).toEqual({ uz: ['section:2'], en: ['title', 'lead', 'section:1', 'section:2'] })
  })

  it('отметка уже стояла — неполный перевод не блокирует (новость просто выпадает из языка)', () => {
    const news = newsRow({ publishOn: ['uz'] })
    expect(blockedNewLocales(['uz'], news, [])).toEqual({})
  })

  it('полный перевод — можно отмечать', () => {
    const news = newsRow({ publishOn: ['uz'] })
    const rows = translationRows(news.id, { uz: { title: 'T', lead: 'L', sections: { [news.sections[0].id]: '<p>a</p>' } } }, news.sections)
    expect(blockedNewLocales([], news, rows)).toEqual({})
  })

  it('состояние языков для админки', () => {
    const news = newsRow({ publishOn: ['uz'] })
    expect(localeStates(news, [])).toEqual({
      uz: { enabled: true, missing: ['title', 'lead', 'section:1'] },
      en: { enabled: false, missing: ['title', 'lead', 'section:1'] },
    })
  })
})
