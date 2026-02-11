import React, { useEffect, useState } from 'react'
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { fetchSubmissions, fetchSubmissionStats } from '@/features/forms/formsSlice'
import type { FormSubmissionLog, FormSubmissionStatus } from '@/shared/types/form'

interface SubmissionsPanelProps {
  formId: string
}

const STATUS_ICONS: Record<FormSubmissionStatus, React.ReactNode> = {
  success: <CheckCircle className="w-4 h-4 text-green-500" />,
  partial: <AlertTriangle className="w-4 h-4 text-yellow-500" />,
  failed: <XCircle className="w-4 h-4 text-red-500" />,
}

const STATUS_LABELS: Record<FormSubmissionStatus, string> = {
  success: 'Успешно',
  partial: 'Частично',
  failed: 'Ошибка',
}

export const SubmissionsPanel: React.FC<SubmissionsPanelProps> = ({ formId }) => {
  const dispatch = useAppDispatch()
  const { submissions, submissionsTotal, stats } = useAppSelector((state) => state.forms)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [page, setPage] = useState(0)
  const limit = 20

  useEffect(() => {
    dispatch(fetchSubmissions({
      formId,
      params: { status: statusFilter || undefined, limit, offset: page * limit },
    }))
    dispatch(fetchSubmissionStats(formId))
  }, [dispatch, formId, statusFilter, page])

  const totalPages = Math.ceil(submissionsTotal / limit)

  return (
    <div className="space-y-4">
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white border rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-gray-800">{stats.total}</div>
            <div className="text-xs text-gray-500 mt-1">Всего заявок</div>
          </div>
          {stats.byStatus.map((s) => (
            <div key={s.status} className="bg-white border rounded-lg p-4 text-center">
              <div className="text-2xl font-bold">
                {Number(s.count)}
              </div>
              <div className="text-xs text-gray-500 mt-1 flex items-center justify-center gap-1">
                {STATUS_ICONS[s.status as FormSubmissionStatus]}
                {STATUS_LABELS[s.status as FormSubmissionStatus] || s.status}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filter & Refresh */}
      <div className="flex items-center gap-3">
        <select
          className="border rounded-lg px-3 py-2 text-sm"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(0) }}
        >
          <option value="">Все статусы</option>
          <option value="success">Успешные</option>
          <option value="partial">Частичные</option>
          <option value="failed">Ошибки</option>
        </select>
        <button
          onClick={() => {
            dispatch(fetchSubmissions({ formId, params: { status: statusFilter || undefined, limit, offset: page * limit } }))
            dispatch(fetchSubmissionStats(formId))
          }}
          className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"
          title="Обновить"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
        <span className="text-sm text-gray-400 ml-auto">
          {submissionsTotal} {submissionsTotal === 1 ? 'заявка' : 'заявок'}
        </span>
      </div>

      {/* Table */}
      {submissions.length === 0 ? (
        <div className="text-center py-12 text-gray-400">Нет заявок</div>
      ) : (
        <div className="space-y-2">
          {submissions.map((sub) => (
            <SubmissionRow
              key={sub.id}
              submission={sub}
              isExpanded={expandedId === sub.id}
              onToggle={() => setExpandedId(expandedId === sub.id ? null : sub.id)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
            className="px-3 py-1 border rounded text-sm disabled:opacity-30"
          >
            ← Назад
          </button>
          <span className="text-sm text-gray-500">
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
            disabled={page >= totalPages - 1}
            className="px-3 py-1 border rounded text-sm disabled:opacity-30"
          >
            Далее →
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Submission Row ──────────────────────────────────────────────

interface SubmissionRowProps {
  submission: FormSubmissionLog
  isExpanded: boolean
  onToggle: () => void
}

const SubmissionRow: React.FC<SubmissionRowProps> = ({ submission, isExpanded, onToggle }) => {
  const dataEntries = Object.entries(submission.data || {})

  return (
    <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50"
        onClick={onToggle}
      >
        {STATUS_ICONS[submission.status]}
        <span className="text-sm font-medium text-gray-700 flex-1">
          {dataEntries.slice(0, 3).map(([k, v]) => `${k}: ${String(v).slice(0, 30)}`).join(' | ')}
        </span>
        <span className="text-xs text-gray-400 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {new Date(submission.createdAt).toLocaleString('ru-RU')}
        </span>
        {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </div>

      {isExpanded && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-3">
          {/* Data */}
          <div className="mb-3">
            <h4 className="text-xs font-medium text-gray-500 mb-2">Данные</h4>
            <div className="bg-gray-50 rounded p-3 text-sm space-y-1">
              {dataEntries.map(([key, val]) => (
                <div key={key} className="flex">
                  <span className="text-gray-500 w-32 shrink-0">{key}:</span>
                  <span className="text-gray-800">{String(val)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Destination results */}
          {submission.destinationResults && submission.destinationResults.length > 0 && (
            <div className="mb-3">
              <h4 className="text-xs font-medium text-gray-500 mb-2">Результаты отправки</h4>
              <div className="space-y-1">
                {submission.destinationResults.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    {r.success
                      ? <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                      : <XCircle className="w-3.5 h-3.5 text-red-500" />}
                    <span>{r.destinationName}</span>
                    <span className="text-xs text-gray-400">{r.durationMs}мс</span>
                    {r.error && <span className="text-xs text-red-500">— {r.error}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="text-xs text-gray-400 flex gap-4">
            {submission.ip && <span>IP: {submission.ip}</span>}
            {submission.referrer && <span>Referrer: {submission.referrer}</span>}
          </div>
        </div>
      )}
    </div>
  )
}
