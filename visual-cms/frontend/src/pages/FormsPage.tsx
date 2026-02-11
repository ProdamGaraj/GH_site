import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/shared/components/Button'
import { Input } from '@/shared/components/Input'
import { Header } from '@/shared/components/Header'
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Copy,
  MoreVertical,
  FileText,
  Send,
  BarChart3,
} from 'lucide-react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import {
  fetchForms,
  deleteForm,
  duplicateForm,
} from '@/features/forms/formsSlice'
import type { Form, FormStatus } from '@/shared/types/form'
import { DESTINATION_TYPE_ICONS } from '@/shared/types/form'

const STATUS_LABELS: Record<FormStatus, string> = {
  draft: 'Черновик',
  active: 'Активна',
  disabled: 'Отключена',
}

const STATUS_COLORS: Record<FormStatus, string> = {
  draft: 'bg-yellow-100 text-yellow-800',
  active: 'bg-green-100 text-green-800',
  disabled: 'bg-gray-100 text-gray-500',
}

export const FormsPage: React.FC = () => {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { items: forms, loading, error } = useAppSelector((state) => state.forms)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  useEffect(() => {
    dispatch(fetchForms({ search: search || undefined, status: statusFilter || undefined }))
  }, [dispatch, search, statusFilter])

  const handleDelete = useCallback(
    async (id: string, name: string) => {
      if (window.confirm(`Удалить форму "${name}"?`)) {
        await dispatch(deleteForm(id))
      }
    },
    [dispatch]
  )

  const handleDuplicate = useCallback(
    (id: string) => {
      dispatch(duplicateForm(id))
      setOpenMenuId(null)
    },
    [dispatch]
  )

  return (
    <div className="p-6">
      <Header />

      <div className="px-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Формы обратной связи</h1>
          <p className="text-sm text-gray-500 mt-1">Создавайте формы и настраивайте передачу данных в любые источники</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Поиск по названию..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        <select
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">Все статусы</option>
          <option value="draft">Черновики</option>
          <option value="active">Активные</option>
          <option value="disabled">Отключённые</option>
        </select>

        <Button variant="primary" onClick={() => navigate('/forms/new')}>
          <Plus className="w-4 h-4 mr-1" />
          Новая форма
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center py-12 text-gray-500">Загрузка...</div>
      )}

      {/* Empty state */}
      {!loading && forms.length === 0 && (
        <div className="text-center py-16">
          <FileText className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">Нет форм</h3>
          <p className="text-gray-400 mb-6">
            Создайте первую форму обратной связи для вашего сайта
          </p>
          <Button variant="primary" onClick={() => navigate('/forms/new')}>
            <Plus className="w-4 h-4 mr-1" />
            Создать форму
          </Button>
        </div>
      )}

      {/* Forms Grid */}
      {!loading && forms.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {forms.map((form) => (
            <FormCard
              key={form.id}
              form={form}
              isMenuOpen={openMenuId === form.id}
              onToggleMenu={() => setOpenMenuId(openMenuId === form.id ? null : form.id)}
              onEdit={() => navigate(`/forms/${form.id}`)}
              onDelete={() => handleDelete(form.id, form.name)}
              onDuplicate={() => handleDuplicate(form.id)}
            />
          ))}
        </div>
      )}
      </div>
    </div>
  )
}

// ─── Form Card ───────────────────────────────────────────────────

interface FormCardProps {
  form: Form
  isMenuOpen: boolean
  onToggleMenu: () => void
  onEdit: () => void
  onDelete: () => void
  onDuplicate: () => void
}

const FormCard: React.FC<FormCardProps> = ({
  form,
  isMenuOpen,
  onToggleMenu,
  onEdit,
  onDelete,
  onDuplicate,
}) => {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">{form.name}</h3>
          {form.description && (
            <p className="text-sm text-gray-500 mt-1 line-clamp-2">{form.description}</p>
          )}
        </div>

        <div className="relative ml-2">
          <button
            onClick={onToggleMenu}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <MoreVertical className="w-4 h-4 text-gray-400" />
          </button>
          {isMenuOpen && (
            <div className="absolute right-0 top-8 bg-white border rounded-lg shadow-lg py-1 z-10 w-40">
              <button
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                onClick={onEdit}
              >
                <Edit className="w-3.5 h-3.5" /> Редактировать
              </button>
              <button
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                onClick={onDuplicate}
              >
                <Copy className="w-3.5 h-3.5" /> Дублировать
              </button>
              <hr className="my-1" />
              <button
                className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                onClick={onDelete}
              >
                <Trash2 className="w-3.5 h-3.5" /> Удалить
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Status badge */}
      <div className="flex items-center gap-2 mb-3">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[form.status]}`}>
          {STATUS_LABELS[form.status]}
        </span>
        <span className="text-xs text-gray-400">{form.fields.length} полей</span>
      </div>

      {/* Destinations */}
      {form.destinations?.length > 0 && (
        <div className="flex items-center gap-1 mb-3">
          <Send className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-xs text-gray-500 mr-1">
            Получатели:
          </span>
          {form.destinations.map((d) => (
            <span
              key={d.id}
              title={`${d.name} (${d.type})`}
              className="text-xs"
            >
              {DESTINATION_TYPE_ICONS[d.type] || '📦'}
            </span>
          ))}
        </div>
      )}

      {/* Stats */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <div className="flex items-center gap-1 text-xs text-gray-400">
          <BarChart3 className="w-3.5 h-3.5" />
          {form.submissionsCount} заявок
        </div>
        <div className="text-xs text-gray-400">
          {new Date(form.updatedAt).toLocaleDateString('ru-RU')}
        </div>
      </div>

      {/* Edit button */}
      <button
        onClick={onEdit}
        className="w-full mt-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
      >
        Открыть
      </button>
    </div>
  )
}

export default FormsPage
