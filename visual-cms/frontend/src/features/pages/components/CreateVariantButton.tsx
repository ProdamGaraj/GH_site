import React, { useState } from 'react'
import { CopyPlus, Loader2 } from 'lucide-react'
import { pageApi } from '@/shared/api'
import type { Page } from '@/shared/types'

/**
 * «Создать вариант» — черновик-копия страницы с тем же адресом, вместе с
 * переводами и привязками данных. Потом его правят и одной кнопкой делают
 * основным вместо опубликованного (PublishToggle).
 */
export const CreateVariantButton: React.FC<{
  page: { id: string; name: string }
  onCreated: (variant: Page) => void
}> = ({ page, onCreated }) => {
  const [busy, setBusy] = useState(false)

  const run = async () => {
    setBusy(true)
    try {
      onCreated(await pageApi.createVariant(page.id))
    } catch (e: any) {
      window.alert(e?.message || 'Не получилось создать вариант')
    } finally {
      setBusy(false)
    }
  }

  const title = `Создать вариант «${page.name}» (черновик с тем же адресом)`
  const Icon = busy ? Loader2 : CopyPlus
  return (
    <button
      type="button"
      onClick={run}
      disabled={busy}
      className="p-1 text-sky-600 hover:text-sky-800 disabled:opacity-50"
      title={title}
      aria-label={title}
    >
      <Icon size={18} className={busy ? 'animate-spin' : undefined} />
    </button>
  )
}
