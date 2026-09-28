/**
 * Свайп в существующих каруселях: телефон и планшет. На живом слайдере главной
 * (fixtures/heroSliderBlock.json) и на синтетике для краёв.
 */
import { addDefaultSwipe, defaultSwipeScreens, SWIPE_ATTR } from '../scripts/carouselSwipe'
import type { StructureNode } from '../scripts/choiceToPlanTypes'
import { styleGenerator } from '../services/StyleGenerator'
import type { BlockNode } from '../types/blockNode'

const HERO: StructureNode = require('./fixtures/heroSliderBlock.json')

const carousel = (id: string, attrs: Record<string, string> = {}): StructureNode => ({
  id,
  tagName: 'div',
  attributes: { 'data-carousel': 'true', ...attrs },
  children: [],
  metadata: { name: id },
})

describe('defaultSwipeScreens', () => {
  it('стандартные экраны — телефон и планшет', () => {
    expect(defaultSwipeScreens(styleGenerator.getBreakpoints({} as BlockNode))).toEqual(['tablet', 'mobile'])
  })

  it('свои экраны страницы — все уже 1024 px', () => {
    expect(
      defaultSwipeScreens([
        { id: 'wide', name: 'Wide', width: 1280 },
        { id: 'pad', name: 'Pad', width: 1000 },
        { id: 'phone', name: 'Phone', width: 360 },
      ])
    ).toEqual(['pad', 'phone'])
  })
})

describe('addDefaultSwipe', () => {
  it('слайдер главной получает свайп на телефоне и планшете', () => {
    const { structure, changes, alreadyMigrated } = addDefaultSwipe(HERO, ['tablet', 'mobile'])
    expect(alreadyMigrated).toBe(false)
    expect(structure.attributes?.[SWIPE_ATTR]).toBe('tablet,mobile')
    expect(changes).toEqual(['карусель «Hero Slider»: свайп на экранах tablet,mobile'])
    // Остальное не тронуто.
    expect({ ...structure, attributes: { ...structure.attributes, [SWIPE_ATTR]: undefined } }).toEqual({
      ...HERO,
      attributes: { ...HERO.attributes, [SWIPE_ATTR]: undefined },
    })
  })

  it('повторный запуск ничего не меняет', () => {
    const once = addDefaultSwipe(HERO, ['mobile']).structure
    const again = addDefaultSwipe(once, ['mobile'])
    expect(again.alreadyMigrated).toBe(true)
    expect(again.structure).toBe(once)
  })

  it('уже выбранная в редакторе настройка, в том числе «выключено», не трогается', () => {
    const root: StructureNode = {
      id: 'page',
      children: [carousel('a', { [SWIPE_ATTR]: 'desktop-hd' }), carousel('b', { [SWIPE_ATTR]: '' }), carousel('c')],
    }
    const { structure, changes } = addDefaultSwipe(root, ['mobile'])
    expect(structure.children!.map((c) => c.attributes![SWIPE_ATTR])).toEqual(['desktop-hd', '', 'mobile'])
    expect(changes).toEqual(['карусель «c»: свайп на экранах mobile'])
  })

  it('карусели во вложенных узлах и экранных вставках тоже', () => {
    const root: StructureNode = {
      id: 'page',
      children: [{ id: 'wrap', children: [carousel('nested')] }],
      variations: { mobile: { specificChildren: [carousel('mobile-only')] } },
    }
    const { structure } = addDefaultSwipe(root, ['mobile'])
    expect(structure.children![0].children![0].attributes![SWIPE_ATTR]).toBe('mobile')
    const variations = structure.variations as Record<string, { specificChildren: StructureNode[] }>
    expect(variations.mobile.specificChildren[0].attributes![SWIPE_ATTR]).toBe('mobile')
  })

  it('не карусели не трогаются, вход не меняется', () => {
    const root: StructureNode = { id: 'page', children: [{ id: 'x', attributes: { 'data-carousel': 'false' } }] }
    expect(addDefaultSwipe(root, ['mobile']).alreadyMigrated).toBe(true)
    addDefaultSwipe(HERO, ['mobile'])
    expect(HERO.attributes?.[SWIPE_ATTR]).toBeUndefined()
  })

  it('без экранов — ошибка, а не молчаливое «выключено»', () => {
    expect(() => addDefaultSwipe(HERO, [])).toThrow(/Нет экранов/)
  })
})
