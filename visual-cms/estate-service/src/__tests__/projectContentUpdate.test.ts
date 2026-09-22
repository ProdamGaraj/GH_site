/**
 * Заливка текстов книги в существующий комплекс.
 *
 * Главное свойство — не трогать лишнего: прогон без правок в книге не должен
 * писать в базу, а неполный лист не должен затирать поля, заполненные руками
 * в админке.
 */
import {
  planComplexUpdate,
  planTranslationRows,
  diffTranslations,
  TranslationRow,
} from '../scripts/projectContentUpdate'

const current = {
  slug: 'harizma',
  name: 'Harizma',
  intro: 'старое вступление',
  about: 'старый текст',
  address: 'г. Ташкент, Катта Дархон 15',
  stats: [{ value: 'Бизнес', label: 'Класс жилья' }],
  yardFeatures: ['Старый пункт'],
}

describe('planComplexUpdate', () => {
  it('отдаёт только изменившиеся поля', () => {
    const changes = planComplexUpdate(current, { intro: 'новое вступление', about: 'старый текст' })
    expect(changes).toEqual([{ field: 'intro', from: 'старое вступление', to: 'новое вступление' }])
  })

  it('поля, которых нет в книге, не трогает — иначе затёрло бы правки из админки', () => {
    const changes = planComplexUpdate(current, { intro: 'новое' })
    expect(changes.map((c) => c.field)).not.toContain('address')
    expect(changes.map((c) => c.field)).not.toContain('name')
  })

  it('пустая строка в книге не считается значением — пустотой не затираем', () => {
    expect(planComplexUpdate(current, { intro: '', about: undefined })).toEqual([])
  })

  it('jsonb сравнивается по содержимому, а не по ссылке', () => {
    const same = planComplexUpdate(current, { stats: [{ value: 'Бизнес', label: 'Класс жилья' }] })
    expect(same).toEqual([])
    const changed = planComplexUpdate(current, { stats: [{ value: 'Комфорт', label: 'Класс жилья' }] })
    expect(changed).toHaveLength(1)
  })

  it('массив строк тоже сравнивается по содержимому', () => {
    expect(planComplexUpdate(current, { yardFeatures: ['Старый пункт'] })).toEqual([])
    expect(planComplexUpdate(current, { yardFeatures: ['Новый пункт'] })).toHaveLength(1)
  })

  it('поле, которого в базе ещё нет, считается изменением', () => {
    const changes = planComplexUpdate(current, { hallTitle: 'Дизайнерские холлы' })
    expect(changes).toEqual([{ field: 'hallTitle', from: undefined, to: 'Дизайнерские холлы' }])
  })

  it('пустое значение в базе и пустое в книге — не изменение', () => {
    expect(planComplexUpdate({ hallText: '' }, { hallText: '' })).toEqual([])
    expect(planComplexUpdate({ hallText: null as unknown as string }, { hallText: '' })).toEqual([])
  })
})

describe('planTranslationRows', () => {
  it('строки — как есть, jsonb — строкой JSON (так их ждёт applyOverlay)', () => {
    const rows = planTranslationRows('c1', 'uz', {
      intro: 'Kirish',
      stats: [{ value: 'Biznes', label: 'Turar joy toifasi' }],
    })
    expect(rows).toEqual([
      { entityType: 'complex', entityId: 'c1', locale: 'uz', field: 'intro', value: 'Kirish' },
      {
        entityType: 'complex',
        entityId: 'c1',
        locale: 'uz',
        field: 'stats',
        value: '[{"value":"Biznes","label":"Turar joy toifasi"}]',
      },
    ])
  })

  it('поля вне реестра переводимых пропускаются — оверлей их всё равно не наложит', () => {
    // slug переводить нельзя: по нему строится URL страницы.
    const rows = planTranslationRows('c1', 'uz', { slug: 'harizma' } as never)
    expect(rows).toEqual([])
  })

  it('пустые значения не создают строк перевода', () => {
    expect(planTranslationRows('c1', 'uz', { intro: '', about: undefined })).toEqual([])
  })
})

describe('diffTranslations', () => {
  const planned: TranslationRow[] = [
    { entityType: 'complex', entityId: 'c1', locale: 'uz', field: 'intro', value: 'Kirish' },
    { entityType: 'complex', entityId: 'c1', locale: 'uz', field: 'about', value: 'Loyiha' },
  ]

  it('совпавшие переводы не переписываются — прогон без правок не трогает базу', () => {
    const existing = [
      { field: 'intro', value: 'Kirish' },
      { field: 'about', value: 'Loyiha' },
    ]
    expect(diffTranslations(planned, existing)).toEqual([])
  })

  it('изменившийся перевод попадает в запись', () => {
    const existing = [{ field: 'intro', value: 'Старое' }, { field: 'about', value: 'Loyiha' }]
    expect(diffTranslations(planned, existing).map((r) => r.field)).toEqual(['intro'])
  })

  it('отсутствующий перевод попадает в запись', () => {
    expect(diffTranslations(planned, []).map((r) => r.field)).toEqual(['intro', 'about'])
  })

  it('лишние переводы в базе не удаляются — их мог завести редактор', () => {
    const existing = [
      { field: 'intro', value: 'Kirish' },
      { field: 'about', value: 'Loyiha' },
      { field: 'hallText', value: 'Редакторский перевод' },
    ]
    expect(diffTranslations(planned, existing)).toEqual([])
  })
})
