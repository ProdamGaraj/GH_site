import type { MediaFolder } from '@/shared/api/mediaApi'

export interface FolderTreeNode {
  folder: MediaFolder
  children: FolderTreeNode[]
  depth: number
}

/** Строит дерево из плоского списка папок (по parentId). Сортировка по имени. */
export function buildFolderTree(folders: MediaFolder[]): FolderTreeNode[] {
  const byParent = new Map<string, MediaFolder[]>()
  for (const f of folders) {
    const key = f.parentId ?? '__root__'
    if (!byParent.has(key)) byParent.set(key, [])
    byParent.get(key)!.push(f)
  }

  const build = (parentKey: string, depth: number): FolderTreeNode[] => {
    const list = (byParent.get(parentKey) ?? []).slice().sort((a, b) => a.name.localeCompare(b.name))
    return list.map((folder) => ({
      folder,
      depth,
      children: build(folder.id, depth + 1),
    }))
  }

  return build('__root__', 0)
}

/** Разворачивает дерево в плоский список с глубиной — для отступов в рендере. */
export function flattenTree(nodes: FolderTreeNode[]): FolderTreeNode[] {
  const out: FolderTreeNode[] = []
  const walk = (list: FolderTreeNode[]) => {
    for (const n of list) {
      out.push(n)
      walk(n.children)
    }
  }
  walk(nodes)
  return out
}

/** Путь от корня до папки (включительно) — для хлебных крошек. */
export function getFolderPath(folders: MediaFolder[], id: string | null): MediaFolder[] {
  if (!id) return []
  const byId = new Map(folders.map((f) => [f.id, f]))
  const path: MediaFolder[] = []
  let cur = byId.get(id)
  const guard = new Set<string>()
  while (cur && !guard.has(cur.id)) {
    guard.add(cur.id)
    path.unshift(cur)
    cur = cur.parentId ? byId.get(cur.parentId) : undefined
  }
  return path
}

/** Множество id всех потомков папки (чтобы не давать переместить в саму себя/потомка). */
export function collectDescendantIds(folders: MediaFolder[], rootId: string): Set<string> {
  const byParent = new Map<string, MediaFolder[]>()
  for (const f of folders) {
    const key = f.parentId ?? '__root__'
    if (!byParent.has(key)) byParent.set(key, [])
    byParent.get(key)!.push(f)
  }
  const result = new Set<string>()
  const stack = [rootId]
  while (stack.length) {
    const cur = stack.pop()!
    for (const child of byParent.get(cur) ?? []) {
      if (!result.has(child.id)) {
        result.add(child.id)
        stack.push(child.id)
      }
    }
  }
  return result
}
