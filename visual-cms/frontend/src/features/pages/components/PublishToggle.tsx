import React, { useState } from 'react'
import { EyeOff, Loader2, UploadCloud } from 'lucide-react'
import { deployApi } from '@/shared/api'

interface PublishTogglePage {
  id: string
  name: string
  slug: string
  status: 'draft' | 'published' | 'archived'
}

/**
 * Опубликовать / снять страницу — единственный способ сменить статус
 * «Опубликовано». Настройки страницы его не меняют: прямая смена статуса
 * расходилась с файлами на сайте.
 *
 * Снятие убирает страницу со всех языков сразу; главную сервер снять не даст
 * и объяснит почему.
 */
export const PublishToggle: React.FC<{
  page: PublishTogglePage
  onChanged: () => void
}> = ({ page, onChanged }) => {
  const [busy, setBusy] = useState(false)
  const published = page.status === 'published'

  const run = async () => {
    const question = published
      ? `Снять «${page.name}» (/${page.slug}) с публикации?\n\nСтраница перестанет открываться на сайте на всех языках и станет черновиком.`
      : `Опубликовать «${page.name}» по адресу /${page.slug}?`
    if (!window.confirm(question)) return
    setBusy(true)
    try {
      if (published) await deployApi.unpublishPage(page.id)
      else await deployApi.deployPage(page.id)
      onChanged()
    } catch (e: any) {
      window.alert(e?.message || 'Не получилось')
    } finally {
      setBusy(false)
    }
  }

  const Icon = busy ? Loader2 : published ? EyeOff : UploadCloud
  return (
    <button
      type="button"
      onClick={run}
      disabled={busy}
      className={`p-1 disabled:opacity-50 ${
        published ? 'text-amber-600 hover:text-amber-800' : 'text-green-600 hover:text-green-800'
      }`}
      title={published ? 'Снять с публикации' : 'Опубликовать'}
    >
      <Icon size={18} className={busy ? 'animate-spin' : undefined} />
    </button>
  )
}
