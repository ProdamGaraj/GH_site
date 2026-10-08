import React, { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Loader2, X } from 'lucide-react'
import { inputCls } from '@/shared/forms/fields'
import { cn } from '@/shared/utils'
import { newsCmsApi } from '../api'
import type { AnchorCandidate, AnchorKind, BlockAnchorInfo, DataAnchor } from '../types'
import { rememberBlockAnchors } from './useBlockAnchors'

export const ANCHOR_KIND_LABELS: Record<AnchorKind, string> = {
  text: 'Текст',
  richtext: 'Форматированный текст',
  image: 'Картинка',
  link: 'Ссылка',
}

/** Каким видом можно сделать кандидата: текст ↔ форматированный текст, остальное — своим. */
export function compatibleKinds(kind: AnchorKind): AnchorKind[] {
  return kind === 'text' || kind === 'richtext' ? ['text', 'richtext'] : [kind]
}

interface Row {
  candidate: AnchorCandidate
  checked: boolean
  label: string
  kind: AnchorKind
}

function sampleText(c: AnchorCandidate): string {
  const s = typeof c.sample === 'string' ? c.sample : `${c.sample.text} → ${c.sample.href}`
  const plain = c.kind === 'richtext' ? s.replace(/<[^>]+>/g, ' ') : s
  const t = plain.replace(/\s+/g, ' ').trim()
  return t.length > 90 ? t.slice(0, 90) + '…' : t
}

/** Где блок показывается со своим текстом — строками для предупреждения. */
function usageLines(info: BlockAnchorInfo): string[] {
  const u = info.usage
  return [
    ...u.pages.map((p) => `страница «${p.name}» (/${p.slug})`),
    ...u.blocks.map((b) => `внутри блока «${b.name}»`),
    ...u.projects.map((s) => `слайд проекта ${s}`),
    ...u.unchecked.map((s) => `не удалось проверить: ${s}`),
  ]
}

/**
 * Блок библиотеки → блок данных для новости.
 *
 *  - у блока уже есть якоря — он добавляется как есть; копия — только по
 *    кнопке (блок, который стоит в других новостях, без просьбы не копируется);
 *  - якорей нет — выбор полей: «данные» отмечены, «похоже на интерфейс»
 *    (стрелки, кнопки, счётчики) — ниже и не отмечены; затем «переписать этот
 *    блок» (если он нигде не показывается со своим текстом) или «создать копию».
 */
export const BlockAnchorsDialog: React.FC<{
  blockId: string
  onClose: () => void
  onReady: (blockId: string, name: string, anchors: DataAnchor[]) => void
}> = ({ blockId, onClose, onReady }) => {
  const [info, setInfo] = useState<BlockAnchorInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [rows, setRows] = useState<Row[]>([])
  const [copyName, setCopyName] = useState('')

  useEffect(() => {
    let cancelled = false
    newsCmsApi
      .dataAnchors(blockId)
      .then((data) => {
        if (cancelled) return
        setInfo(data)
        setCopyName(`${data.block.name} — для новостей`)
        setRows(data.candidates.map((c) => ({ candidate: c, checked: c.suggested, label: c.label, kind: c.kind })))
      })
      .catch((e) => !cancelled && setError(e?.message || 'Не удалось прочитать блок'))
    return () => {
      cancelled = true
    }
  }, [blockId])

  const data = rows.filter((r) => r.candidate.suggested)
  const noise = rows.filter((r) => !r.candidate.suggested)
  const picks = useMemo(() => rows.filter((r) => r.checked).map((r) => ({ nodeId: r.candidate.nodeId, kind: r.kind, label: r.label.trim() || r.candidate.label })), [rows])
  const setRow = (nodeId: string, kind: AnchorKind, patch: Partial<Row>) =>
    setRows((list) => list.map((r) => (r.candidate.nodeId === nodeId && r.candidate.kind === kind ? { ...r, ...patch } : r)))

  const run = async (mode: 'rewrite' | 'copy', withPicks = true) => {
    if (!info) return
    if (mode === 'rewrite' && !confirm(`Переписать «${info.block.name}»? Текст и картинки выбранных полей заменятся данными новостей. Копия прежнего блока сохранится на сервере.`)) return
    setBusy(true)
    setError(null)
    try {
      const result = await newsCmsApi.makeDataBlock(blockId, { mode, picks: withPicks ? picks : [], ...(mode === 'copy' ? { name: copyName } : {}) })
      rememberBlockAnchors(result.blockId, { name: result.name, anchors: result.anchors })
      onReady(result.blockId, result.name, result.anchors)
    } catch (e: any) {
      setError(e?.message || 'Не удалось подготовить блок')
      setBusy(false)
    }
  }

  const renderRow = (r: Row) => {
    const c = r.candidate
    const kinds = compatibleKinds(c.kind)
    return (
      <li key={`${c.nodeId}:${c.kind}`} className="flex flex-wrap items-start gap-2 py-2" data-testid="anchor-candidate" data-suggested={c.suggested ? 'true' : 'false'}>
        <input
          type="checkbox"
          className="mt-2 h-4 w-4"
          checked={r.checked}
          onChange={(e) => setRow(c.nodeId, c.kind, { checked: e.target.checked })}
          aria-label={`Якорь: ${c.label}`}
        />
        <div className="min-w-0 flex-1 space-y-1">
          <input className={cn(inputCls, 'py-1 text-sm')} value={r.label} aria-label={`Название поля: ${c.label}`} onChange={(e) => setRow(c.nodeId, c.kind, { label: e.target.value })} />
          <div className="text-xs text-gray-500 truncate" title={sampleText(c)}>
            {c.kind === 'image' && typeof c.sample === 'string' ? <img src={c.sample} alt="" className="inline-block h-6 w-10 object-cover rounded mr-1 align-middle" /> : null}
            {sampleText(c)}
          </div>
          {c.noiseReason && <div className="text-xs text-amber-700">Похоже на интерфейс: {c.noiseReason}</div>}
        </div>
        {kinds.length > 1 ? (
          <select className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs" value={r.kind} aria-label={`Вид поля: ${c.label}`} onChange={(e) => setRow(c.nodeId, c.kind, { kind: e.target.value as AnchorKind })}>
            {kinds.map((k) => (
              <option key={k} value={k}>
                {ANCHOR_KIND_LABELS[k]}
              </option>
            ))}
          </select>
        ) : (
          <span className="px-2 py-1 text-xs text-gray-500">{ANCHOR_KIND_LABELS[c.kind]}</span>
        )}
      </li>
    )
  }

  const hasAnchors = (info?.anchors.length ?? 0) > 0
  const elsewhere = info ? usageLines(info) : []
  const canRewrite = info?.actions.includes('rewrite') ?? false

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Блок для новости">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h2 className="text-lg font-semibold text-gray-900">{info ? `Блок «${info.block.name}» в новость` : 'Блок в новость'}</h2>
          <button type="button" onClick={onClose} aria-label="Закрыть" className="p-1 text-gray-400 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {!info && !error && (
            <p className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 size={16} className="animate-spin" /> Читаю блок и где он используется…
            </p>
          )}
          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}

          {info && hasAnchors && (
            <div className="space-y-2 text-sm text-gray-700" data-testid="anchors-ready">
              <p>Блок уже готов для новостей — поля: {info.anchors.map((a) => a.label).join(', ')}.</p>
              {info.usage.news.length > 0 && <p className="text-gray-500">Он стоит и в других новостях ({info.usage.news.length}) — правка блока изменит их все.</p>}
            </div>
          )}

          {info && !hasAnchors && (
            <>
              <p className="text-sm text-gray-600">
                Выберите поля, которые новость будет заполнять своими данными. Их текст и картинки в блоке заменятся данными новости.
              </p>
              {elsewhere.length > 0 && (
                <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800" data-testid="anchors-elsewhere">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  <div>
                    Блок показывается со своим текстом: {elsewhere.join('; ')}. Переписать его нельзя — там вместо текста появились бы
                    пустые поля. Будет создана копия с якорями, исходный блок останется как есть.
                  </div>
                </div>
              )}
              <section>
                <h3 className="text-sm font-semibold text-gray-800">Данные ({data.length})</h3>
                {data.length === 0 ? <p className="text-sm text-gray-400">Подходящих полей не найдено.</p> : <ul className="divide-y">{data.map(renderRow)}</ul>}
              </section>
              {noise.length > 0 && (
                <section>
                  <h3 className="text-sm font-semibold text-gray-500">Похоже на интерфейс — не отмечено ({noise.length})</h3>
                  <ul className="divide-y">{noise.map(renderRow)}</ul>
                </section>
              )}
            </>
          )}
        </div>

        {info && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t px-5 py-3">
            {hasAnchors ? (
              <>
                <button type="button" disabled={busy} onClick={() => run('copy', false)} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                  Создать отдельную копию
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    rememberBlockAnchors(info.block.id, { name: info.block.name, anchors: info.anchors })
                    onReady(info.block.id, info.block.name, info.anchors)
                  }}
                  className="rounded-md bg-primary-600 px-4 py-1.5 text-sm text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  Добавить в новость
                </button>
              </>
            ) : (
              <>
                <input className={cn(inputCls, 'max-w-xs py-1 text-sm')} value={copyName} onChange={(e) => setCopyName(e.target.value)} aria-label="Имя копии" />
                <button type="button" disabled={busy || picks.length === 0} onClick={() => run('copy')} className="rounded-md bg-primary-600 px-4 py-1.5 text-sm text-white hover:bg-primary-700 disabled:opacity-50">
                  Создать копию с якорями
                </button>
                {canRewrite && (
                  <button type="button" disabled={busy || picks.length === 0} onClick={() => run('rewrite')} className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50">
                    Переписать этот блок
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
