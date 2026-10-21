/**
 * Структура нового блока библиотеки из выделенного элемента («Создать блок
 * из элемента» в редакторе).
 *
 * Элемент — экземпляр блока библиотеки (metadata.linkedBlockId): своего у
 * экземпляра только атрибуты, а дети, стили и CSS живут в блоке библиотеки
 * (LinkedBlocksService). Раньше новый блок получал узел экземпляра как есть —
 * без CSS блока: копия «Complex location» выходила без стилей. Теперь основа
 * — структура блока библиотеки, поверх — атрибуты экземпляра (как их видит
 * страница), связь с исходным блоком снимается: это отдельный блок.
 *
 * Обычный элемент — как есть, без следов экземпляра.
 */

type Structure = Record<string, any>

/** Снимает метаданные экземпляра: новый блок ни с чем не связан. */
export function stripInstanceArtifacts(structure: Structure | null | undefined): void {
  if (structure?.metadata) {
    delete structure.metadata.linkedBlockId
    delete structure.metadata.styleOverrides
  }
}

export async function blockStructureFromElement(
  element: Structure,
  loadLibraryStructure: (blockId: string) => Promise<Structure | null>,
): Promise<Structure> {
  const linkedId = element?.metadata?.linkedBlockId
  const library = typeof linkedId === 'string' && linkedId ? await loadLibraryStructure(linkedId) : null
  if (!library) {
    const plain = JSON.parse(JSON.stringify(element))
    stripInstanceArtifacts(plain)
    return plain
  }
  const copy: Structure = JSON.parse(JSON.stringify(library))
  copy.id = element.id ?? copy.id
  copy.attributes = { ...(copy.attributes ?? {}), ...(element.attributes ?? {}) }
  copy.metadata = { ...(copy.metadata ?? {}), ...(element.metadata?.name ? { name: element.metadata.name } : {}) }
  stripInstanceArtifacts(copy)
  return copy
}
