import { describe, it, expect } from 'vitest'
import type { MediaFolder } from '@/shared/api/mediaApi'
import { buildFolderTree, flattenTree, getFolderPath, collectDescendantIds } from './folderTree'

function folder(id: string, name: string, parentId: string | null = null): MediaFolder {
  return {
    id,
    name,
    parentId,
    siteId: null,
    createdAt: '2026-06-15T00:00:00Z',
    updatedAt: '2026-06-15T00:00:00Z',
  }
}

// a ── b ── c
//  └── d
const folders: MediaFolder[] = [
  folder('a', 'A'),
  folder('b', 'B', 'a'),
  folder('c', 'C', 'b'),
  folder('d', 'D', 'a'),
]

describe('folderTree', () => {
  describe('buildFolderTree', () => {
    it('builds a tree with correct depth and sorted siblings', () => {
      const tree = buildFolderTree(folders)
      expect(tree).toHaveLength(1)
      expect(tree[0].folder.id).toBe('a')
      expect(tree[0].depth).toBe(0)
      // children of A: B and D, отсортированы по имени
      expect(tree[0].children.map((n) => n.folder.id)).toEqual(['b', 'd'])
      expect(tree[0].children[0].depth).toBe(1)
      // C под B
      expect(tree[0].children[0].children.map((n) => n.folder.id)).toEqual(['c'])
    })

    it('returns empty for no folders', () => {
      expect(buildFolderTree([])).toEqual([])
    })
  })

  describe('flattenTree', () => {
    it('flattens depth-first preserving order', () => {
      const flat = flattenTree(buildFolderTree(folders))
      expect(flat.map((n) => n.folder.id)).toEqual(['a', 'b', 'c', 'd'])
      expect(flat.map((n) => n.depth)).toEqual([0, 1, 2, 1])
    })
  })

  describe('getFolderPath', () => {
    it('returns root-to-node path', () => {
      expect(getFolderPath(folders, 'c').map((f) => f.id)).toEqual(['a', 'b', 'c'])
      expect(getFolderPath(folders, 'd').map((f) => f.id)).toEqual(['a', 'd'])
    })

    it('returns empty for null', () => {
      expect(getFolderPath(folders, null)).toEqual([])
    })

    it('is cycle-safe (does not loop forever)', () => {
      const cyclic: MediaFolder[] = [folder('x', 'X', 'y'), folder('y', 'Y', 'x')]
      const path = getFolderPath(cyclic, 'x')
      expect(path.length).toBeLessThanOrEqual(2)
    })
  })

  describe('collectDescendantIds', () => {
    it('collects all descendants', () => {
      expect([...collectDescendantIds(folders, 'a')].sort()).toEqual(['b', 'c', 'd'])
      expect([...collectDescendantIds(folders, 'b')].sort()).toEqual(['c'])
      expect([...collectDescendantIds(folders, 'c')]).toEqual([])
    })
  })
})
