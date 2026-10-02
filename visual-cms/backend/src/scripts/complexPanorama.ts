/**
 * «Панорама 360°» в разделе «Локация» страницы проекта (блок «Complex location»).
 *
 * Ссылка была в разметке дизайна, но всегда скрытой (hidden) и вела на эту же
 * секцию (#location): ни в шаблоне, ни в админке estate ссылки на панораму не
 * было, хотя поле у проекта есть (complexes.panoramaUrl). Теперь:
 * - estate отдаёт `item.panorama` — массив 0..1 ({ url });
 * - ссылка обёрнута в повтор по item.panorama: есть ссылка у проекта — есть
 *   кнопка, нет — нет (условий в движке шаблонов нет, условность — длиной
 *   массива). Обёртка — display: contents, раскладка строки не меняется;
 * - href — ссылка проекта, открывается в новой вкладке (сервисы панорам часто
 *   запрещают встраивание на чужой сайт).
 *
 * Вид кнопки (v2): у рамки были толщина и цвет, но не тип линии — рамку рисовал
 * только сброс Tailwind в редакторе, на сайте кнопка выглядела текстом. И
 * длинный текст локации сжимал её в две строки. Теперь тип линии задан явно,
 * кнопка в одну строку и не сжимается.
 *
 * Узел ссылки сохраняет id — его перевод («360° panorama») продолжает работать.
 * Чистое преобразование; запись — `migrate-complex-panorama.ts`. Идемпотентно.
 */
import { MigrationError, MigrationResult, StructureNode, findAll, findOne, makeNode } from './choiceToPlanTypes'

export const PANORAMA_LINK_ID = 'panoramaLink'
export const PANORAMA_SOURCE = 'item.panorama'
export const PANORAMA_LINK_STYLES: Readonly<Record<string, string>> = {
  borderStyle: 'solid',
  whiteSpace: 'nowrap',
  flexShrink: '0',
}

const isLink = (n: StructureNode) => n.attributes?.id === PANORAMA_LINK_ID

export function migrateComplexPanorama(input: StructureNode): MigrationResult {
  const structure: StructureNode = JSON.parse(JSON.stringify(input))
  const changes: string[] = []

  const link = findOne(structure, isLink, `ссылка #${PANORAMA_LINK_ID}`)
  const [parent] = findAll(structure, (n) => (n.children ?? []).includes(link))
  if (!parent) throw new MigrationError(`У ссылки #${PANORAMA_LINK_ID} нет родителя`)

  if (parent._repeat?.source !== PANORAMA_SOURCE) {
    const wrapper = makeNode({
      id: `${link.id}--repeat`,
      tagName: 'span',
      elementType: 'container',
      attributes: { class: 'panorama-repeat' },
      styles: { properties: { display: 'contents' } },
      metadata: { name: 'Панорама 360° (есть ссылка у проекта)' },
      _repeat: { source: PANORAMA_SOURCE },
      children: [link],
    })
    parent.children = parent.children!.map((child) => (child === link ? wrapper : child))
    changes.push(`ссылка обёрнута в повтор по ${PANORAMA_SOURCE}: кнопка есть, только если у проекта есть панорама`)
  }

  const attrs = link.attributes ?? {}
  const wanted: Record<string, string> = { href: '{{$.url}}', target: '_blank', rel: 'noopener' }
  const differs = Object.entries(wanted).some(([key, value]) => attrs[key] !== value) || 'hidden' in attrs
  if (differs) {
    const { hidden: _hidden, ...rest } = attrs
    link.attributes = { ...rest, ...wanted }
    changes.push('ссылка: href — панорама проекта, новая вкладка, без hidden')
  }

  const props = link.styles?.properties ?? {}
  if (Object.entries(PANORAMA_LINK_STYLES).some(([key, value]) => props[key] !== value)) {
    link.styles = { ...link.styles, properties: { ...props, ...PANORAMA_LINK_STYLES } }
    changes.push('кнопка: рамка сплошной линией, в одну строку, не сжимается текстом')
  }

  if (changes.length === 0) return { structure: input, changes, alreadyMigrated: true }
  return { structure, changes, alreadyMigrated: false }
}
