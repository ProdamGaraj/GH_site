import React, { useState } from 'react'
import { EyeOff, Loader2, Repeat, UploadCloud } from 'lucide-react'
import { deployApi, slugOccupiedDetails } from '@/shared/api'

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
 *
 * Варианты страницы: у адреса опубликован один вариант. Опубликовать другой —
 * значит заменить им опубликованный. `occupant` — опубликованный вариант того
 * же адреса, если список его знает; если нет (список устарел), сервер ответит
 * 409, и замена всё равно пойдёт через подтверждение.
 */
export const PublishToggle: React.FC<{
  page: PublishTogglePage
  occupant?: { name: string }
  onChanged: () => void
}> = ({ page, occupant, onChanged }) => {
  const [busy, setBusy] = useState(false)
  const published = page.status === 'published'

  const replaceQuestion = (name: string) =>
    `Сейчас на /${page.slug} опубликована «${name}».\n\nОпубликовать «${page.name}» вместо неё? ` +
    `«${name}» станет черновиком, адрес не будет пустовать ни на секунду.`

  const replace = async (name: string) => {
    if (!window.confirm(replaceQuestion(name))) return
    await deployApi.deployPage(page.id, { replace: true })
    onChanged()
  }

  const publish = async () => {
    try {
      await deployApi.deployPage(page.id)
      onChanged()
    } catch (e) {
      const occupied = slugOccupiedDetails(e)
      if (!occupied) throw e
      await replace(occupied.occupant.name)
    }
  }

  const run = async () => {
    if (!published && occupant) {
      setBusy(true)
      try {
        await replace(occupant.name)
      } catch (e: any) {
        window.alert(e?.message || 'Не получилось')
      } finally {
        setBusy(false)
      }
      return
    }
    const question = published
      ? `Снять «${page.name}» (/${page.slug}) с публикации?\n\nСтраница перестанет открываться на сайте на всех языках и станет черновиком.`
      : `Опубликовать «${page.name}» по адресу /${page.slug}?`
    if (!window.confirm(question)) return
    setBusy(true)
    try {
      if (published) {
        await deployApi.unpublishPage(page.id)
        onChanged()
      } else {
        await publish()
      }
    } catch (e: any) {
      window.alert(e?.message || 'Не получилось')
    } finally {
      setBusy(false)
    }
  }

  const Icon = busy ? Loader2 : published ? EyeOff : occupant ? Repeat : UploadCloud
  const title = published
    ? 'Снять с публикации'
    : occupant
      ? `Сделать основным вместо «${occupant.name}»`
      : 'Опубликовать'
  return (
    <button
      type="button"
      onClick={run}
      disabled={busy}
      className={`p-1 disabled:opacity-50 ${
        published ? 'text-amber-600 hover:text-amber-800' : 'text-green-600 hover:text-green-800'
      }`}
      title={title}
      aria-label={title}
    >
      <Icon size={18} className={busy ? 'animate-spin' : undefined} />
    </button>
  )
}
