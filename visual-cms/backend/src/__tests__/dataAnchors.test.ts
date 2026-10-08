/**
 * Якоря данных блока: поиск кандидатов («данные» / «похоже на интерфейс»),
 * замена содержимого плейсхолдерами, копия с новыми id. Часть — на живых
 * блоках библиотеки со стенда (fixtures/libraryBlocksSample.json).
 */
jest.mock('../config/database', () => ({
  AppDataSource: { getRepository: jest.fn().mockReturnValue({ findOne: jest.fn(), find: jest.fn(), save: jest.fn() }) },
}))

import {
  anchorKeyFor,
  applyAnchors,
  cloneWithNewIds,
  detectAnchorCandidates,
  findAnchors,
  noiseReasonOf,
  type AnchorNode,
} from '../services/dataAnchors'
import { deployService } from '../services/DeployService'

const LIVE: Array<{ name: string; structure: AnchorNode }> = require('./fixtures/libraryBlocksSample.json')
const live = (name: string) => LIVE.find((b) => b.name === name)!.structure

const promo: AnchorNode = {
  id: 'root',
  tagName: 'section',
  elementType: 'container',
  styles: { properties: { backgroundImage: 'url("/media/bg.jpg")' } },
  children: [
    { id: 'title', tagName: 'h2', elementType: 'text', content: 'Рассрочка 0%' },
    {
      id: 'lead',
      tagName: 'p',
      elementType: 'text',
      content: 'Без переплаты ',
      children: [{ id: 'lead-b', tagName: 'strong', elementType: 'container', content: 'до 2028 года' }],
    },
    { id: 'photo', tagName: 'img', elementType: 'image', attributes: { src: '/media/photo.jpg', alt: 'Фото' } },
    { id: 'cta', tagName: 'a', elementType: 'text', content: 'Оставить заявку', attributes: { href: '/contacts' } },
    { id: 'more', tagName: 'a', elementType: 'text', content: 'Подробнее →', attributes: { href: '/promo' } },
    { id: 'arrow', tagName: 'span', elementType: 'text', content: '↗' },
    { id: 'counter', tagName: 'span', elementType: 'text', content: '01 / 04', attributes: { 'data-carousel-counter': 'true' } },
    { id: 'btn', tagName: 'button', elementType: 'button', content: 'Показать все' },
    { id: 'icon', tagName: 'img', elementType: 'image', attributes: { src: '/media/arrow.svg' } },
    { id: 'bound', tagName: 'span', elementType: 'text', content: '{{item.name}}' },
    { id: 'nested', metadata: { linkedBlockId: 'other-block' }, children: [{ id: 'nested-text', tagName: 'p', elementType: 'text', content: 'Чужой блок' }] },
  ],
}

describe('detectAnchorCandidates', () => {
  const byId = Object.fromEntries(detectAnchorCandidates(promo).map((c) => [c.nodeId + '/' + c.kind, c]))

  it('данные: заголовок, абзац с форматированием, фото, фон, ссылка — отмечены', () => {
    expect(byId['title/text']).toMatchObject({ suggested: true, sample: 'Рассрочка 0%', label: 'Заголовок · «Рассрочка 0%»' })
    expect(byId['lead/richtext']).toMatchObject({ suggested: true, sample: 'Без переплаты <strong>до 2028 года</strong>' })
    expect(byId['photo/image']).toMatchObject({ suggested: true, sample: '/media/photo.jpg', label: 'Картинка' })
    expect(byId['root/image']).toMatchObject({ suggested: true, sample: '/media/bg.jpg', label: 'Фон' })
    expect(byId['cta/link']).toMatchObject({ suggested: true, sample: { href: '/contacts', text: 'Оставить заявку' } })
  })

  it('интерфейс — не отмечен и с причиной', () => {
    expect(byId['more/link']).toMatchObject({ suggested: false, noiseReason: 'типовая подпись интерфейса' })
    expect(byId['arrow/text']).toMatchObject({ suggested: false, noiseReason: 'символ или стрелка' })
    expect(byId['counter/text']).toMatchObject({ suggested: false, noiseReason: 'элемент управления (стрелки, точки, языки)' })
    expect(byId['btn/text']).toMatchObject({ suggested: false, noiseReason: 'кнопка интерфейса' })
    expect(byId['icon/image']).toMatchObject({ suggested: false, noiseReason: 'иконка (svg)' })
  })

  it('не кандидаты: уже связанное с данными, части абзаца, узлы вложенного блока', () => {
    for (const key of Object.keys(byId)) {
      expect(key).not.toMatch(/^(bound|lead-b|nested|nested-text)\//)
    }
  })

  it('живой блок «Commerce hero»: фон, заголовок и абзацы — данные; поля формы и кнопка — интерфейс', () => {
    const c = detectAnchorCandidates(live('Commerce hero'))
    const suggested = c.filter((x) => x.suggested).map((x) => x.label)
    expect(suggested).toEqual(expect.arrayContaining(['Фон', 'Заголовок · «Коммерческая недвижимость»']))
    const noise = c.filter((x) => !x.suggested)
    expect(noise.length).toBeGreaterThan(0)
    for (const n of noise) expect(n.noiseReason).toBeTruthy()
  })

  it('живая «Navigation»: почти всё — интерфейс (меню, языки), данных мало', () => {
    const c = detectAnchorCandidates(live('Navigation'))
    expect(c.filter((x) => !x.suggested).length).toBeGreaterThan(0)
  })
})

describe('noiseReasonOf', () => {
  const t = (content: string, extra: Partial<AnchorNode> = {}) => noiseReasonOf({ id: 'x', tagName: 'span', elementType: 'text', content, ...extra }, [], 'text', content)
  it('aria-hidden у предка — декор', () => {
    expect(noiseReasonOf({ id: 'x', content: 'Текст' }, [{ attributes: { 'aria-hidden': 'true' } }], 'text', 'Текст')).toBe('скрыт от чтения — декор')
  })
  it('обычный текст, аббревиатуры и цифры статистики — данные', () => {
    expect(t('Офисы')).toBeNull()
    expect(t('БЦ')).toBeNull()
    expect(t('15+')).toBeNull()
    expect(t('65')).toBeNull()
  })

  it('стрелки, символы, счётчик слайдов, типовые подписи — интерфейс', () => {
    expect(t('→')).toBe('символ или стрелка')
    expect(t('+')).toBe('символ или стрелка')
    expect(t('02 / 05')).toBe('счётчик слайдов')
    expect(t('Batafsil')).toBe('типовая подпись интерфейса')
  })
})

describe('anchorKeyFor', () => {
  it('из подписи — латиница; повторы получают номер; цифра в начале — префикс', () => {
    const taken = new Set<string>()
    expect(anchorKeyFor('Заголовок · «Рассрочка»', taken)).toBe('zagolovok')
    expect(anchorKeyFor('Заголовок', taken)).toBe('zagolovok_2')
    expect(anchorKeyFor('30 лет', taken)).toBe('f_30_let')
    expect(anchorKeyFor('!!!', taken)).toBe('field')
  })
})

describe('applyAnchors', () => {
  const picks = [
    { nodeId: 'title', kind: 'text' as const, label: 'Заголовок' },
    { nodeId: 'lead', kind: 'richtext' as const, label: 'Текст' },
    { nodeId: 'photo', kind: 'image' as const, label: 'Фото' },
    { nodeId: 'root', kind: 'image' as const, label: 'Фон' },
    { nodeId: 'cta', kind: 'link' as const, label: 'Кнопка заявки' },
  ]
  const result = applyAnchors(promo, picks)
  const node = (id: string) => {
    let hit: AnchorNode | undefined
    const visit = (n: AnchorNode) => (n.id === id ? (hit = n) : (n.children ?? []).forEach(visit))
    visit(result.structure)
    return hit!
  }

  it('содержимое — плейсхолдеры, образцы — в metadata.dataAnchor', () => {
    expect(node('title').content).toBe('{{$.zagolovok}}')
    expect(node('title').metadata!.dataAnchor).toEqual({ key: 'zagolovok', label: 'Заголовок', kind: 'text', sample: 'Рассрочка 0%' })
    expect(node('lead')).toMatchObject({ elementType: 'html-code', tagName: 'div', content: '{{$.tekst}}', children: [] })
    expect(node('photo').attributes).toEqual({ src: '{{$.foto}}', alt: 'Фото' })
    expect(result.structure.styles!.properties!.backgroundImage).toBe('url("{{$.fon}}")')
    expect(node('cta').attributes!.href).toBe('{{$.knopka_zayavki.href}}')
    expect(node('cta').content).toBe('{{$.knopka_zayavki.text}}')
  })

  it('исходник не мутирует; список якорей и заменённых полей', () => {
    expect(promo.children![0].content).toBe('Рассрочка 0%')
    expect(result.anchors.map((a) => a.key)).toEqual(['fon', 'zagolovok', 'tekst', 'foto', 'knopka_zayavki'])
    expect(result.replacedFields).toEqual(
      expect.arrayContaining([
        { nodeId: 'title', field: 'content' },
        { nodeId: 'lead-b', field: 'content' },
        { nodeId: 'photo', field: 'src' },
        { nodeId: 'root', field: 'bg:image' },
        { nodeId: 'cta', field: 'href' },
      ])
    )
    expect(findAnchors(result.structure)).toHaveLength(5)
  })

  it('текст и форматированный текст взаимозаменяемы; картинку текстом не сделать', () => {
    const asRich = applyAnchors(promo, [{ nodeId: 'title', kind: 'richtext', label: 'T' }]).structure.children![0]
    expect(asRich).toMatchObject({ elementType: 'html-code', content: '{{$.t}}' })
    const asText = applyAnchors(promo, [{ nodeId: 'lead', kind: 'text', label: 'L' }]).structure.children![1]
    expect(asText).toMatchObject({ content: '{{$.l}}', children: [] })
  })

  it('неподходящий узел или вид — ошибка, ничего не меняется', () => {
    expect(() => applyAnchors(promo, [{ nodeId: 'bound', kind: 'text', label: 'x' }])).toThrow()
    expect(() => applyAnchors(promo, [{ nodeId: 'photo', kind: 'text', label: 'x' }])).toThrow()
  })

  it('после подстановки значений новости — нормальная разметка', () => {
    const svc = deployService as any
    const ctx = {
      zagolovok: 'Ипотека 12%',
      tekst: '<p>Новый <b>текст</b></p>',
      foto: '/media/n.jpg',
      fon: '/media/nbg.jpg',
      knopka_zayavki: { href: '/apply', text: 'Подать заявку' },
    }
    const out = JSON.parse(JSON.stringify(result.structure))
    svc.substituteNode(out, { item: {}, $: ctx })
    const n = (id: string) => {
      let hit: any
      const visit = (x: any) => (x.id === id ? (hit = x) : (x.children ?? []).forEach(visit))
      visit(out)
      return hit
    }
    expect(n('title').content).toBe('Ипотека 12%')
    expect(n('lead').content).toBe('<p>Новый <b>текст</b></p>')
    expect(n('photo').attributes.src).toBe('/media/n.jpg')
    expect(out.styles.properties.backgroundImage).toBe('url("/media/nbg.jpg")')
    expect(n('cta').attributes.href).toBe('/apply')
    expect(n('cta').content).toBe('Подать заявку')
  })
})

describe('cloneWithNewIds', () => {
  it('новые id у всех своих узлов, вложенный блок — ссылкой, экранные правки — по новым id', () => {
    const withVariation: AnchorNode = {
      ...promo,
      variations: { mobile: { inheritedOverrides: { title: { styles: { fontSize: '20px' } } } } as any },
    }
    let n = 0
    const { structure, idMap } = cloneWithNewIds(withVariation, () => `new-${++n}`)
    expect(idMap.get('root')).toBe('new-1')
    expect(structure.id).toBe('new-1')
    expect(idMap.has('nested-text')).toBe(false)
    const nested = structure.children!.find((c) => c.metadata?.linkedBlockId)!
    expect(nested.metadata!.linkedBlockId).toBe('other-block')
    expect(Object.keys((structure.variations!.mobile as any).inheritedOverrides)).toEqual([idMap.get('title')])
    expect(promo.id).toBe('root')
  })
})
