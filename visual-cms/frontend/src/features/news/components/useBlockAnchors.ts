import { useEffect, useState } from 'react'
import { newsCmsApi } from '../api'
import type { DataAnchor } from '../types'

/**
 * Имя и якоря блока данных для формы секции-блока. Без обхода «где
 * используется» (usage=0); кэш на сессию вкладки, чтобы секции одного блока
 * не спрашивали по разу. После копии/переписывания диалог кладёт ответ сам.
 */
export interface BlockAnchors {
  name: string
  anchors: DataAnchor[]
}

const cache = new Map<string, Promise<BlockAnchors>>()

export function rememberBlockAnchors(blockId: string, value: BlockAnchors): void {
  cache.set(blockId, Promise.resolve(value))
}

/** Для тестов: забыть закэшированное. */
export function forgetBlockAnchors(): void {
  cache.clear()
}

export function loadBlockAnchors(blockId: string): Promise<BlockAnchors> {
  let hit = cache.get(blockId)
  if (!hit) {
    hit = newsCmsApi.dataAnchors(blockId, false).then((info) => ({ name: info.block.name, anchors: info.anchors }))
    hit.catch(() => cache.delete(blockId))
    cache.set(blockId, hit)
  }
  return hit
}

export function useBlockAnchors(blockId: string | undefined): { data: BlockAnchors | null; error: string | null } {
  const [data, setData] = useState<BlockAnchors | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!blockId) return
    let cancelled = false
    setData(null)
    setError(null)
    loadBlockAnchors(blockId)
      .then((v) => !cancelled && setData(v))
      .catch((e) => !cancelled && setError(e?.message || 'Блок не найден в библиотеке'))
    return () => {
      cancelled = true
    }
  }, [blockId])
  return { data, error }
}
