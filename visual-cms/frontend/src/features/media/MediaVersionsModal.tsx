import React, { useState } from 'react'
import { Check, Copy, ExternalLink, X } from 'lucide-react'
import { resolveMediaUrl, type MediaAsset } from '@/shared/api/mediaApi'
import { useOverlayClose } from '@/shared/hooks/useOverlayClose'
import { formatBytes, listMediaVersions, savingLabel } from './mediaVersions'

interface MediaVersionsModalProps {
  /** Файл, чьи версии показать; null — окно закрыто. */
  asset: MediaAsset | null
  onClose: () => void
  /** Копирование в буфер (общее с карточкой файла). */
  onCopy: (text: string) => Promise<boolean>
}

/**
 * Окно «Размеры»: все версии одной картинки — оригинал, сжатая и уменьшенные
 * копии. В медиатеке они не лежат отдельными файлами, поэтому раньше их было
 * не найти: о них говорил только значок с числом на плитке.
 */
export const MediaVersionsModal: React.FC<MediaVersionsModalProps> = ({ asset, onClose, onCopy }) => {
  const overlay = useOverlayClose(onClose)
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null)
  if (!asset) return null

  const versions = listMediaVersions(asset)

  const copy = async (url: string) => {
    if (await onCopy(url)) {
      setCopiedUrl(url)
      window.setTimeout(() => setCopiedUrl((current) => (current === url ? null : current)), 1500)
    }
  }

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/50" {...overlay}>
      <div
        role="dialog"
        aria-label="Размеры файла"
        className="bg-white rounded-lg shadow-xl w-[min(620px,94vw)] max-h-[85vh] flex flex-col"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-gray-900">Размеры файла</h2>
            <div className="text-xs text-gray-500 truncate" title={asset.fileName}>
              {asset.title || asset.fileName}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 text-gray-500"
            aria-label="Закрыть"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-4 py-2 text-xs text-gray-500 border-b border-gray-100">
          Это один файл медиатеки. В страницу вставляется он, а сайт при публикации сам подставляет
          посетителю версию под ширину его экрана.
        </div>

        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="text-gray-500 text-left">
              <tr>
                <th className="px-4 py-2 font-medium">Версия</th>
                <th className="px-2 py-2 font-medium">Размер</th>
                <th className="px-2 py-2 font-medium text-right">Вес</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {versions.map((version) => {
                const url = resolveMediaUrl(version.url)
                const saving = version.kind === 'original' ? '' : savingLabel(version.sizeBytes, asset.sizeBytes)
                return (
                  <tr key={version.url} className="border-t border-gray-100">
                    <td className="px-4 py-2">
                      <div className="text-gray-900">{version.label}</div>
                      <div className="text-gray-400">{version.note}</div>
                    </td>
                    <td className="px-2 py-2 tabular-nums text-gray-700 whitespace-nowrap">
                      {version.width ? `${version.width}${version.height ? ` × ${version.height}` : ''}` : '—'}
                    </td>
                    <td className="px-2 py-2 tabular-nums text-right whitespace-nowrap">
                      <span className="text-gray-900">{formatBytes(version.sizeBytes)}</span>
                      {saving && <span className="ml-1.5 text-green-700">{saving}</span>}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded hover:bg-gray-100 text-gray-600"
                          aria-label={`Открыть: ${version.label}`}
                          title="Открыть"
                        >
                          <ExternalLink size={14} />
                        </a>
                        <button
                          type="button"
                          onClick={() => copy(url)}
                          className="p-1.5 rounded hover:bg-gray-100 text-gray-600"
                          aria-label={`Копировать ссылку: ${version.label}`}
                          title="Копировать ссылку"
                        >
                          {copiedUrl === url ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
