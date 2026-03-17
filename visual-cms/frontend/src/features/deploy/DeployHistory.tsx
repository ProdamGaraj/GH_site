import { useState, useEffect } from 'react'
import { Rocket, Clock, AlertTriangle, CheckCircle2, XCircle, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react'
import { deployApi, type DeployLogEntry } from '@/shared/api'

interface DeployHistoryProps {
  siteId?: string
  pageId?: string
}

const ACTION_LABELS: Record<string, string> = {
  deploy: 'Деплой страницы',
  rollback: 'Откат',
  undeploy: 'Удаление',
  'deploy-all': 'Деплой всех',
  'deploy-site': 'Деплой сайта',
}

const STATUS_CONFIG = {
  success: { icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50', label: 'Успешно' },
  failed: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', label: 'Ошибка' },
  partial: { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50', label: 'Частично' },
} as const

export function DeployHistory({ siteId, pageId }: DeployHistoryProps) {
  const [logs, setLogs] = useState<DeployLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const data = await deployApi.getLogs({ siteId, pageId, limit: 30 })
        setLogs(data)
      } catch (err) {
        console.error('Failed to load deploy logs:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [siteId, pageId])

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  }

  const formatDuration = (ms?: number) => {
    if (!ms) return '—'
    if (ms < 1000) return `${ms}мс`
    return `${(ms / 1000).toFixed(1)}с`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-12 px-4">
        <Rocket className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-500">Нет записей о деплое</p>
      </div>
    )
  }

  return (
    <div className="divide-y divide-gray-100">
      {logs.map((log) => {
        const cfg = STATUS_CONFIG[log.status]
        const StatusIcon = cfg.icon
        const isExpanded = expandedId === log.id

        return (
          <div key={log.id}>
            <button
              onClick={() => setExpandedId(isExpanded ? null : log.id)}
              className="w-full px-4 py-3 flex items-start gap-3 hover:bg-gray-50 text-left transition-colors"
            >
              <div className={`mt-0.5 p-1.5 rounded ${cfg.bg}`}>
                {log.action === 'rollback' ? (
                  <RotateCcw className={`w-3.5 h-3.5 ${cfg.color}`} />
                ) : (
                  <StatusIcon className={`w-3.5 h-3.5 ${cfg.color}`} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">{ACTION_LABELS[log.action] || log.action}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                </div>
                {log.pageName && <p className="text-xs text-gray-500 truncate">{log.pageName}</p>}
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-gray-400">{formatDate(log.createdAt)}</span>
                  {log.durationMs && (
                    <>
                      <span className="text-xs text-gray-300">•</span>
                      <span className="text-xs text-gray-400 flex items-center gap-0.5">
                        <Clock className="w-3 h-3" />{formatDuration(log.durationMs)}
                      </span>
                    </>
                  )}
                </div>
              </div>
              {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400 mt-1" /> : <ChevronDown className="w-4 h-4 text-gray-400 mt-1" />}
            </button>

            {isExpanded && (
              <div className="px-4 pb-3 bg-gray-50 border-t border-gray-100 text-xs">
                {log.message && <p className="text-gray-600 mt-2">{log.message}</p>}
                {log.deployedFiles && log.deployedFiles.length > 0 && (
                  <div className="mt-2">
                    <p className="text-gray-500 font-medium mb-1">Файлы:</p>
                    <ul className="text-gray-600 space-y-0.5">
                      {log.deployedFiles.map((f, i) => (
                        <li key={i} className="flex items-center gap-1">
                          <span className="w-1 h-1 bg-green-400 rounded-full" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {log.errors && log.errors.length > 0 && (
                  <div className="mt-2">
                    <p className="text-red-500 font-medium mb-1">Ошибки:</p>
                    <ul className="text-red-600 space-y-0.5">
                      {log.errors.map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                  </div>
                )}
                {log.publicUrl && (
                  <p className="mt-2 text-gray-500">URL: <a href={log.publicUrl} target="_blank" rel="noreferrer" className="text-primary-600 hover:underline">{log.publicUrl}</a></p>
                )}
                {log.pageVersion && <p className="mt-1 text-gray-400">Версия страницы: v{log.pageVersion}</p>}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
