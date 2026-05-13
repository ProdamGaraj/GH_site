/**
 * Поиск id template'а repeater'а внутри контейнера по структуре страницы.
 *
 * Вынесено из DeployService.findTemplateInContainer для unit-тестирования
 * (DeployService требует TypeORM-инициализации и плохо мокается).
 *
 * Логика приоритетов:
 *  1. По metadata.linkedBlockId === libraryTemplateId (linked-блоки из library).
 *  2. Fallback: первый child с metadata.isTemplate === true.
 *  3. Fallback: первый non-static child.
 *
 * Hybrid-static-слайды (attributes['data-carousel-static'] === 'true') ВСЕГДА
 * исключаются — это намеренно вставленные пользователем статические блоки внутри
 * карусели, не являющиеся template'ом для генерации повторов.
 */

type AnyNode = {
  id?: string
  attributes?: Record<string, unknown>
  metadata?: { linkedBlockId?: string; isTemplate?: boolean }
  children?: AnyNode[]
}

const isHybridStatic = (node: AnyNode | null | undefined): boolean => {
  const v = node?.attributes?.['data-carousel-static']
  return v === 'true' || v === true
}

const findByLinkedId = (node: AnyNode | null | undefined, targetLinkedId: string): string | null => {
  if (!node) return null
  if (!isHybridStatic(node) && node.metadata?.linkedBlockId === targetLinkedId && node.id) {
    return node.id
  }
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      const found = findByLinkedId(child, targetLinkedId)
      if (found) return found
    }
  }
  return null
}

export function findTemplateInContainer(
  structure: AnyNode | null | undefined,
  containerId: string,
  libraryTemplateId?: string
): string | null {
  let templateId: string | null = null

  const findContainer = (node: AnyNode | null | undefined): boolean => {
    if (!node) return false

    if (node.id === containerId) {
      if (libraryTemplateId) {
        templateId = findByLinkedId(node, libraryTemplateId)
        if (templateId) return true
      }

      if (Array.isArray(node.children)) {
        // Hybrid-static-слайды никогда не template.
        const candidates = node.children.filter(c => !isHybridStatic(c))

        const tpl = candidates.find(c => c.metadata?.isTemplate === true)
        if (tpl?.id) {
          templateId = tpl.id
          return true
        }

        const first = candidates[0]
        if (first?.id) {
          templateId = first.id
          return true
        }
      }
      return false
    }

    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        if (findContainer(child)) return true
      }
    }
    return false
  }

  findContainer(structure)
  return templateId
}
