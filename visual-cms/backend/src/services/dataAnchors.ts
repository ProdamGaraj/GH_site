/**
 * Якоря данных у библиотечного блока: места, куда страница с данными (пока —
 * новость) подставляет свои значения.
 *
 * Якорь — это плейсхолдер `{{$.<ключ>}}` на месте содержимого узла плюс
 * описание в metadata.dataAnchor {key, label, kind, sample}. Блок с якорями —
 * «блок данных»: на канвасе он показывает плейсхолдеры, на сайте — значения,
 * которые разворот подставляет вместо `$` (DeployService.expandDataSlideBlocks).
 *
 * Виды:
 *   text     — текст узла; на сайте экранируется;
 *   richtext — форматированный HTML (TipTap): узел становится html-code;
 *   image    — <img src> или фон-картинка узла;
 *   link     — адрес и подпись ссылки: {{$.<ключ>.href}} / {{$.<ключ>.text}}.
 *
 * Кандидаты в якоря находит detectAnchorCandidates и делит на «данные» и
 * «похоже на интерфейс» (стрелки, кнопки, счётчики, типовые подписи) — вторые
 * предлагаются невыбранными, решение за админом.
 *
 * Узлы вложенных библиотечных блоков сюда не входят: это чужие блоки.
 *
 * Чистые функции, без БД.
 */
import { bgUrlPatch, extractBgUrl } from './cssBackground'

export type AnchorKind = 'text' | 'richtext' | 'image' | 'link'

export interface DataAnchor {
  key: string
  label: string
  kind: AnchorKind
  /** Что было в узле до замены плейсхолдером — образец значения для формы. */
  sample: string | { href: string; text: string }
}

export interface AnchorNode {
  id?: string
  tagName?: string
  tag?: string
  elementType?: string
  content?: string
  attributes?: Record<string, string>
  styles?: { properties?: Record<string, any> } & Record<string, any>
  metadata?: Record<string, any>
  children?: AnchorNode[]
  variations?: Record<string, { specificChildren?: AnchorNode[] } | null>
}

export interface AnchorCandidate {
  nodeId: string
  kind: AnchorKind
  label: string
  sample: DataAnchor['sample']
  /** Предлагать отмеченным: похоже на данные. */
  suggested: boolean
  /** Почему похоже на интерфейс (для невыбранных). */
  noiseReason?: string
}

const PLACEHOLDER_RE = /\{\{\s*(item|\$)(\.[a-zA-Z0-9_.]+)?\s*\}\}/

/** Инлайн-разметка внутри абзаца: такой абзац — форматированный текст. */
const INLINE_TAGS = new Set(['b', 'strong', 'i', 'em', 'u', 'br', 'span', 'a', 'mark', 'small', 'sup', 'sub'])

const GENERIC_LABELS = [
  'подробнее', 'смотреть все', 'смотреть всё', 'читать далее', 'читать дальше', 'далее', 'назад', 'вперёд', 'вперед',
  'все новости', 'ещё', 'еще', 'показать ещё', 'показать еще', 'узнать больше', 'перейти', 'открыть', 'закрыть',
  'batafsil', "ko'proq", 'koʼproq', 'barchasi', 'more', 'read more', 'see all', 'view all', 'next', 'prev', 'back', 'close',
]

const CONTROL_ATTRS = /^data-(carousel-(prev|next|counter|dots?)|lang-|site-nav|lightbox)/

const tagOf = (n: AnchorNode) => String(n.tagName || n.tag || '').toLowerCase()
const isLinked = (n: AnchorNode) => typeof n.metadata?.linkedBlockId === 'string' && n.metadata.linkedBlockId !== ''

function walkOwn(root: AnchorNode, visit: (node: AnchorNode, ancestors: AnchorNode[]) => void): void {
  const go = (node: AnchorNode, ancestors: AnchorNode[]) => {
    visit(node, ancestors)
    const next = [...ancestors, node]
    for (const child of node.children ?? []) if (!isLinked(child)) go(child, next)
    for (const variation of Object.values(node.variations ?? {})) {
      for (const child of variation?.specificChildren ?? []) if (!isLinked(child)) go(child, next)
    }
  }
  go(root, [])
}

/** Якоря, которые у блока уже есть. */
export function findAnchors(root: AnchorNode): Array<DataAnchor & { nodeId: string }> {
  const out: Array<DataAnchor & { nodeId: string }> = []
  walkOwn(root, (node) => {
    const a = node.metadata?.dataAnchor
    if (a && typeof a.key === 'string' && node.id) out.push({ ...(a as DataAnchor), nodeId: node.id })
  })
  return out
}

/** Плоский текст узла с инлайн-детьми и сам HTML (для образца форматированного текста). */
function inlineHtml(node: AnchorNode): string {
  const own = node.content ? escapeHtml(node.content) : ''
  const kids = (node.children ?? [])
    .map((c) => {
      const t = tagOf(c)
      if (t === 'br') return '<br>'
      const inner = inlineHtml(c)
      return INLINE_TAGS.has(t) && t !== 'span' ? `<${t}>${inner}</${t}>` : inner
    })
    .join('')
  return own + kids
}

function plainText(node: AnchorNode): string {
  return [node.content ?? '', ...(node.children ?? []).map(plainText)].join(tagOf(node) === 'br' ? '\n' : '')
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Абзац или заголовок, текст которого размечен инлайн-тегами (b, strong, br…). */
function isInlineRich(node: AnchorNode): boolean {
  const kids = node.children ?? []
  return kids.length > 0 && kids.every((c) => INLINE_TAGS.has(tagOf(c)) && !isLinked(c))
}

const KIND_LABEL: Record<string, string> = {
  h1: 'Заголовок', h2: 'Заголовок', h3: 'Подзаголовок', h4: 'Подзаголовок', p: 'Абзац', span: 'Подпись', a: 'Ссылка',
  li: 'Пункт', button: 'Кнопка', img: 'Картинка',
}

function labelOf(node: AnchorNode, kind: AnchorKind, sample: string): string {
  const name = typeof node.metadata?.name === 'string' ? node.metadata.name.trim() : ''
  // Фон узла — это не сам узел: у секции с именем «Акция» поле «Фон · Акция».
  if (kind === 'image' && tagOf(node) !== 'img') return name ? `Фон · ${name}` : 'Фон'
  if (name) return name
  const base = KIND_LABEL[tagOf(node)] ?? (kind === 'image' ? 'Картинка' : 'Текст')
  const snippet = sample.replace(/\s+/g, ' ').trim()
  return snippet && kind !== 'image' ? `${base} · «${snippet.length > 32 ? snippet.slice(0, 32) + '…' : snippet}»` : base
}

/** Почему узел похож на элемент интерфейса, а не на данные; null — похож на данные. */
export function noiseReasonOf(node: AnchorNode, ancestors: readonly AnchorNode[], kind: AnchorKind, text: string): string | null {
  const chain = [...ancestors, node]
  if (chain.some((n) => Object.keys(n.attributes ?? {}).some((k) => CONTROL_ATTRS.test(k)))) return 'элемент управления (стрелки, точки, языки)'
  if (chain.some((n) => n.attributes?.['aria-hidden'] === 'true')) return 'скрыт от чтения — декор'
  if (chain.some((n) => tagOf(n) === 'button' || n.elementType === 'button')) return 'кнопка интерфейса'
  if (kind === 'image') {
    const src = String(node.attributes?.src ?? extractBgUrl(node.styles?.properties) ?? '')
    if (/\.svg(\?|#|$)/i.test(src)) return 'иконка (svg)'
    const size = (v: unknown) => (typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN)
    const props = node.styles?.properties ?? {}
    if ([props.width, props.height].some((v) => size(v) > 0 && size(v) <= 48 && /px$/.test(String(v)))) return 'иконка (мелкая картинка)'
    return null
  }
  const t = text.trim()
  // Цифры — данные (статистика «15+», «65»); без букв и цифр — стрелка или символ.
  if (!/[\p{L}\p{N}]/u.test(t)) return 'символ или стрелка'
  if (/^\d{1,3}\s*[/|]\s*\d{1,3}$/.test(t)) return 'счётчик слайдов'
  if (GENERIC_LABELS.includes(t.toLowerCase().replace(/[\s→↗›»>.…]+$/u, '').trim())) return 'типовая подпись интерфейса'
  return null
}

/**
 * Кандидаты в якоря по узлам самого блока (без вложенных блоков). Узлы, уже
 * связанные с данными (плейсхолдер в содержимом), и узлы внутри абзаца с
 * форматированием (он сам — кандидат целиком) пропускаются.
 */
export function detectAnchorCandidates(root: AnchorNode): AnchorCandidate[] {
  const out: AnchorCandidate[] = []
  const covered = new Set<AnchorNode>()
  walkOwn(root, (node, ancestors) => {
    if (!node.id || covered.has(node) || node.metadata?.dataAnchor) return
    const tag = tagOf(node)
    const attrs = node.attributes ?? {}

    const push = (kind: AnchorKind, sample: DataAnchor['sample'], text: string) => {
      const reason = noiseReasonOf(node, ancestors, kind, text)
      const sampleText = typeof sample === 'string' ? (kind === 'richtext' ? text : sample) : sample.text
      out.push({ nodeId: node.id!, kind, label: labelOf(node, kind, sampleText), sample, suggested: !reason, ...(reason ? { noiseReason: reason } : {}) })
    }

    // Картинки: <img src> и фон-картинка узла.
    if (tag === 'img' && typeof attrs.src === 'string' && attrs.src && !PLACEHOLDER_RE.test(attrs.src)) {
      push('image', attrs.src, '')
      return
    }
    const bg = extractBgUrl(node.styles?.properties)
    if (bg && !PLACEHOLDER_RE.test(bg)) push('image', bg, '')

    if (node.elementType === 'html-code') {
      const html = node.content ?? ''
      if (html.trim() && !PLACEHOLDER_RE.test(html)) push('richtext', html, html.replace(/<[^>]+>/g, ' '))
      return
    }
    if (node.elementType !== 'text' && node.elementType !== 'button') return
    if (['input', 'textarea', 'select', 'option'].includes(tag)) return

    const content = (node.content ?? '').trim()
    if (PLACEHOLDER_RE.test(content)) return
    if (isInlineRich(node)) {
      const text = plainText(node).trim()
      if (!text) return
      walkOwn(node, (inner) => inner !== node && covered.add(inner))
      push('richtext', inlineHtml(node), text)
      return
    }
    if (!content) return
    if (typeof attrs.href === 'string' && attrs.href && !PLACEHOLDER_RE.test(attrs.href)) {
      push('link', { href: attrs.href, text: content }, content)
      return
    }
    push('text', content, content)
  })
  return out
}

// --- Ключи ---

const TRANSLIT: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n',
  о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '',
  э: 'e', ю: 'yu', я: 'ya',
}

/** Ключ плейсхолдера из подписи: латиница, цифры, _; уникальный среди taken. */
export function anchorKeyFor(label: string, taken: Set<string>): string {
  const base =
    label
      .toLowerCase()
      .replace(/\s·\s.*$/, '')
      .split('')
      .map((ch) => TRANSLIT[ch] ?? ch)
      .join('')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 24) || 'field'
  const safe = /^[0-9]/.test(base) ? `f_${base}` : base
  let key = safe
  for (let i = 2; taken.has(key); i++) key = `${safe}_${i}`
  taken.add(key)
  return key
}

// --- Замена содержимого якорями ---

export interface AnchorPick {
  nodeId: string
  kind: AnchorKind
  label: string
}

/**
 * Каким видом можно сделать кандидата: текст и форматированный текст
 * взаимозаменяемы (абзац можно отдать под HTML и наоборот), картинка и ссылка —
 * только своим видом.
 */
export function compatibleKinds(kind: AnchorKind): AnchorKind[] {
  return kind === 'text' || kind === 'richtext' ? ['text', 'richtext'] : [kind]
}

export interface ApplyAnchorsResult {
  structure: AnchorNode
  anchors: Array<DataAnchor & { nodeId: string }>
  /** Поля узлов, чьи переводы больше не нужны: содержимое теперь из данных. */
  replacedFields: Array<{ nodeId: string; field: string }>
}

/**
 * Ставит якоря: содержимое выбранных узлов заменяется плейсхолдерами, образец
 * прежнего содержимого — в metadata.dataAnchor.sample. Структура копируется.
 * Выбранного узла нет или вид не подходит узлу — ошибка (лучше не писать
 * блок, чем записать наполовину).
 */
export function applyAnchors(input: AnchorNode, picks: readonly AnchorPick[]): ApplyAnchorsResult {
  const structure: AnchorNode = JSON.parse(JSON.stringify(input))
  const byId = new Map<string, AnchorNode>()
  walkOwn(structure, (node) => node.id && byId.set(node.id, node))
  const taken = new Set(findAnchors(structure).map((a) => a.key))
  const candidates = detectAnchorCandidates(structure)
  const replacedFields: ApplyAnchorsResult['replacedFields'] = []

  for (const pick of picks) {
    const node = byId.get(pick.nodeId)
    const candidate = candidates.find((c) => c.nodeId === pick.nodeId && compatibleKinds(c.kind).includes(pick.kind))
    if (!node || !candidate) throw new Error(`Узел ${pick.nodeId} не подходит для якоря «${pick.kind}»`)
    const key = anchorKeyFor(pick.label || candidate.label, taken)
    const ph = (path = '') => `{{$.${key}${path}}}`
    switch (pick.kind) {
      case 'text':
        node.content = ph()
        // Абзац с форматированием, отданный под простой текст: инлайн-дети — часть значения.
        if (candidate.kind === 'richtext') {
          for (const child of node.children ?? []) walkOwn(child, (n) => n.id && replacedFields.push({ nodeId: n.id, field: 'content' }))
          node.children = []
        }
        replacedFields.push({ nodeId: pick.nodeId, field: 'content' })
        break
      case 'richtext':
        node.elementType = 'html-code'
        // Значение — блочный HTML (абзацы, списки): внутри <p> он невалиден.
        if (['p', 'span', 'a'].includes(tagOf(node))) node.tagName = 'div'
        node.content = ph()
        for (const child of node.children ?? []) walkOwn(child, (n) => n.id && replacedFields.push({ nodeId: n.id, field: 'content' }))
        node.children = []
        replacedFields.push({ nodeId: pick.nodeId, field: 'content' })
        break
      case 'image':
        if (tagOf(node) === 'img') {
          node.attributes = { ...(node.attributes ?? {}), src: ph() }
          replacedFields.push({ nodeId: pick.nodeId, field: 'src' })
        } else {
          const props = (node.styles ??= {}).properties ?? {}
          for (const [k, v] of Object.entries(bgUrlPatch(props, ph()))) {
            if (v) props[k] = v
            else delete props[k]
          }
          node.styles.properties = props
          replacedFields.push({ nodeId: pick.nodeId, field: 'bg:image' })
        }
        break
      case 'link':
        node.attributes = { ...(node.attributes ?? {}), href: ph('.href') }
        node.content = ph('.text')
        replacedFields.push({ nodeId: pick.nodeId, field: 'content' }, { nodeId: pick.nodeId, field: 'href' })
        break
    }
    node.metadata = { ...(node.metadata ?? {}), dataAnchor: { key, label: pick.label || candidate.label, kind: pick.kind, sample: candidate.sample } }
  }
  return { structure, anchors: findAnchors(structure), replacedFields }
}

// --- Копия блока с новыми id узлов ---

/**
 * Глубокая копия блока с новыми id всех собственных узлов (вложенные блоки —
 * ссылки, их id плейсхолдера тоже новые: у копии свои экземпляры). Новые id
 * обязательны: у копий со старыми id перевод по узлу неоднозначен.
 */
export function cloneWithNewIds(input: AnchorNode, newId: () => string): { structure: AnchorNode; idMap: Map<string, string> } {
  const structure: AnchorNode = JSON.parse(JSON.stringify(input))
  const idMap = new Map<string, string>()
  const visit = (node: AnchorNode) => {
    if (node.id) {
      const next = newId()
      idMap.set(node.id, next)
      node.id = next
    }
    if (isLinked(node)) return
    for (const child of node.children ?? []) visit(child)
    for (const variation of Object.values(node.variations ?? {})) for (const child of variation?.specificChildren ?? []) visit(child)
  }
  visit(structure)
  // Экранные правки (variations.inheritedOverrides) адресуют потомков по id.
  const remapOverrides = (node: AnchorNode) => {
    for (const variation of Object.values(node.variations ?? {}) as Array<Record<string, any> | null>) {
      const io = variation?.inheritedOverrides
      if (io && typeof io === 'object') {
        variation!.inheritedOverrides = Object.fromEntries(Object.entries(io).map(([id, v]) => [idMap.get(id) ?? id, v]))
      }
      for (const child of variation?.specificChildren ?? []) remapOverrides(child)
    }
    if (!isLinked(node)) for (const child of node.children ?? []) remapOverrides(child)
  }
  remapOverrides(structure)
  return { structure, idMap }
}
