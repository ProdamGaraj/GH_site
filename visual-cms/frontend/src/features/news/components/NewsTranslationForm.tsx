import React from 'react'
import { FormSection, TextArea, TextField } from '@/shared/forms/fields'
import { RichTextField } from '@/shared/forms/RichTextField'
import { cn } from '@/shared/utils'
import type { ExtraLocale, NewsDraft, NewsTranslation } from '../types'
import { SECTION_TYPE_LABELS, hasText, missingTranslation, missingText, translatableValue } from '../newsForm'
import type { NewsSection } from '../types'
import { useBlockAnchors } from './useBlockAnchors'

/**
 * Перевод новости на uz/en. Новость появится на этом языке, только если язык
 * отмечен и переведено всё: заголовок, анонс и текст каждого блока. Отметку
 * нельзя поставить, пока перевод неполный; если она уже стоит, а перевод стал
 * неполным (добавили блок), новость пропадёт с языка до перевода.
 */
/**
 * Перевод секции-блока: по полю на якорь с текстом (картинки и адреса ссылок
 * общие для всех языков — их здесь нет).
 */
const BlockSectionTranslation: React.FC<{
  section: NewsSection
  index: number
  label: string
  value: Record<string, string>
  onChange: (key: string, text: string) => void
}> = ({ section, index, label, value, onChange }) => {
  const { data } = useBlockAnchors(section.blockId)
  const entries = Object.entries(section.values ?? {}).filter(([, v]) => {
    const base = translatableValue(v)
    return base !== null && hasText(base)
  })
  const labelOf = (key: string) => data?.anchors.find((a) => a.key === key)?.label ?? key
  if (entries.length === 0) {
    return <p className="text-sm text-gray-400">Блок {index + 1} (из библиотеки) без текста — переводить нечего.</p>
  }
  return (
    <div className="space-y-3 rounded-md border border-indigo-100 p-3" data-testid="news-block-translation">
      <div className="text-sm font-medium text-gray-700">
        Блок {index + 1} · {data ? `«${data.name}»` : SECTION_TYPE_LABELS.block}
      </div>
      {entries.map(([key, v]) =>
        v.kind === 'richtext' ? (
          <div key={key} className="grid gap-4 xl:grid-cols-2 items-start">
            <RichTextField label={`${labelOf(key)} · RU`} value={translatableValue(v) ?? ''} onChange={() => undefined} readOnly />
            <RichTextField label={`${labelOf(key)} · ${label}`} value={value[key] ?? ''} onChange={(html) => onChange(key, html)} placeholder="Перевод" />
          </div>
        ) : (
          <TextField
            key={key}
            label={`${labelOf(key)}${v.kind === 'link' ? ' (подпись ссылки)' : ''} · ${label}`}
            value={value[key] ?? ''}
            placeholder={translatableValue(v) ?? ''}
            onChange={(text) => onChange(key, text)}
          />
        )
      )}
    </div>
  )
}

export const NewsTranslationForm: React.FC<{
  draft: NewsDraft
  locale: ExtraLocale
  onChange: (draft: NewsDraft) => void
}> = ({ draft, locale, onChange }) => {
  const t = draft.translations[locale]
  const missing = missingTranslation(draft, locale)
  const enabled = draft.publishOn.includes(locale)
  const label = locale.toUpperCase()

  const setT = (patch: Partial<NewsTranslation>) =>
    onChange({ ...draft, translations: { ...draft.translations, [locale]: { ...t, ...patch } } })
  const setSection = (id: string, html: string) => setT({ sections: { ...t.sections, [id]: html } })
  const setBlockValue = (id: string, key: string, text: string) =>
    setT({ blocks: { ...(t.blocks ?? {}), [id]: { ...(t.blocks?.[id] ?? {}), [key]: text } } })
  const setEnabled = (on: boolean) =>
    onChange({ ...draft, publishOn: on ? [...draft.publishOn, locale] : draft.publishOn.filter((l) => l !== locale) })

  return (
    <div className="space-y-6">
      <FormSection id={`news-publish-${locale}`} title={`Публикация на ${label}`}>
        <label className={cn('flex items-center gap-2 text-sm font-medium', !enabled && missing.length > 0 ? 'text-gray-400' : 'text-gray-700')}>
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={enabled}
            disabled={!enabled && missing.length > 0}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          Публиковать на {label}
        </label>
        {missing.length === 0 ? (
          <p className="text-sm text-green-700">Перевод полный.</p>
        ) : (
          <p className={cn('text-sm', enabled ? 'text-amber-700' : 'text-gray-500')} data-testid="news-missing">
            {enabled
              ? `Перевод неполный — на ${label} новости не будет, пока не переведено: ${missingText(missing)}.`
              : `Отметить можно, когда переведено всё. Не хватает: ${missingText(missing)}.`}
          </p>
        )}
      </FormSection>

      <FormSection id={`news-texts-${locale}`} title={`Текст — ${label}`}>
        <TextField label="Заголовок" value={t.title} placeholder={draft.title} onChange={(title) => setT({ title })} />
        <TextArea label="Анонс" rows={3} value={t.lead} placeholder={draft.lead} onChange={(lead) => setT({ lead })} />
      </FormSection>

      <FormSection id={`news-sections-${locale}`} title={`Блоки — ${label}`}>
        {draft.sections.length === 0 && <p className="text-sm text-gray-400">В новости нет блоков.</p>}
        {draft.sections.map((section, i) =>
          section.type === 'block' ? (
            <BlockSectionTranslation
              key={section.id}
              section={section}
              index={i}
              label={label}
              value={t.blocks?.[section.id] ?? {}}
              onChange={(key, text) => setBlockValue(section.id, key, text)}
            />
          ) : hasText(section.html) ? (
            <div key={section.id} className="grid gap-4 xl:grid-cols-2 items-start" data-testid="news-section-translation">
              <RichTextField
                label={`Блок ${i + 1} · ${SECTION_TYPE_LABELS[section.type]} · RU`}
                value={section.html}
                onChange={() => undefined}
                readOnly
              />
              <RichTextField
                label={`Блок ${i + 1} · ${label}`}
                value={t.sections[section.id] ?? ''}
                onChange={(html) => setSection(section.id, html)}
                placeholder="Перевод блока"
              />
            </div>
          ) : (
            <p key={section.id} className="text-sm text-gray-400">
              Блок {i + 1} ({SECTION_TYPE_LABELS[section.type]}) без текста — переводить нечего.
            </p>
          )
        )}
      </FormSection>
    </div>
  )
}
