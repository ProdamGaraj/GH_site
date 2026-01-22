import React from 'react'

export type PaginationStyle = 'pages' | 'loadMore' | 'infiniteScroll' | 'prevNext'

export interface PaginationUIConfig {
  style: PaginationStyle
  showTotal?: boolean           // Показывать общее количество
  showPerPage?: boolean         // Показывать selector размера страницы
  perPageOptions?: number[]     // Опции размера страницы
  maxPagesToShow?: number       // Макс. страниц в пагинации
  loadMoreText?: string         // Текст кнопки "Загрузить ещё"
  prevText?: string             // Текст кнопки "Назад"
  nextText?: string             // Текст кнопки "Вперёд"
  position?: 'top' | 'bottom' | 'both' // Позиция пагинации
}

interface PaginationControlsEditorProps {
  config: PaginationUIConfig
  onChange: (config: PaginationUIConfig) => void
}

// Дефолтные значения
const defaultConfig: PaginationUIConfig = {
  style: 'pages',
  showTotal: true,
  showPerPage: true,
  perPageOptions: [10, 20, 50, 100],
  maxPagesToShow: 5,
  loadMoreText: 'Загрузить ещё',
  prevText: '← Назад',
  nextText: 'Вперёд →',
  position: 'bottom',
}

// Стили пагинации
const PAGINATION_STYLES = [
  {
    value: 'pages',
    label: 'Номера страниц',
    desc: '1 2 3 ... 10',
    icon: '📄',
  },
  {
    value: 'loadMore',
    label: 'Загрузить ещё',
    desc: 'Кнопка для подгрузки',
    icon: '➕',
  },
  {
    value: 'infiniteScroll',
    label: 'Бесконечный скролл',
    desc: 'Авто-загрузка при прокрутке',
    icon: '♾️',
  },
  {
    value: 'prevNext',
    label: 'Prev/Next',
    desc: 'Только назад/вперёд',
    icon: '↔️',
  },
] as const

/**
 * Редактор настроек UI пагинации
 */
export const PaginationControlsEditor: React.FC<PaginationControlsEditorProps> = ({
  config,
  onChange,
}) => {
  const updateConfig = (updates: Partial<PaginationUIConfig>) => {
    onChange({ ...defaultConfig, ...config, ...updates })
  }

  const currentConfig = { ...defaultConfig, ...config }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Настройте внешний вид и поведение пагинации
      </p>

      {/* Стиль пагинации */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Стиль пагинации
        </label>
        <div className="grid grid-cols-2 gap-3">
          {PAGINATION_STYLES.map(style => (
            <button
              key={style.value}
              onClick={() => updateConfig({ style: style.value as PaginationStyle })}
              className={`p-3 border rounded-lg text-left transition-all ${
                currentConfig.style === style.value
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">{style.icon}</span>
                <div>
                  <div className="font-medium text-gray-900 text-sm">{style.label}</div>
                  <div className="text-xs text-gray-500">{style.desc}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Настройки для pages */}
      {currentConfig.style === 'pages' && (
        <div className="space-y-3 p-3 bg-gray-50 rounded-lg">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Макс. страниц для показа
            </label>
            <input
              type="number"
              min="3"
              max="15"
              value={currentConfig.maxPagesToShow}
              onChange={(e) => updateConfig({ maxPagesToShow: parseInt(e.target.value) || 5 })}
              className="w-24 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      )}

      {/* Настройки для loadMore */}
      {currentConfig.style === 'loadMore' && (
        <div className="space-y-3 p-3 bg-gray-50 rounded-lg">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Текст кнопки
            </label>
            <input
              type="text"
              value={currentConfig.loadMoreText}
              onChange={(e) => updateConfig({ loadMoreText: e.target.value })}
              placeholder="Загрузить ещё"
              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      )}

      {/* Настройки для infiniteScroll */}
      {currentConfig.style === 'infiniteScroll' && (
        <div className="p-3 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-700">
            ℹ️ Данные будут автоматически подгружаться при прокрутке страницы.
            Рекомендуется использовать с режимом cursor пагинации.
          </p>
        </div>
      )}

      {/* Настройки для prevNext */}
      {currentConfig.style === 'prevNext' && (
        <div className="space-y-3 p-3 bg-gray-50 rounded-lg">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Кнопка "Назад"
              </label>
              <input
                type="text"
                value={currentConfig.prevText}
                onChange={(e) => updateConfig({ prevText: e.target.value })}
                placeholder="← Назад"
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Кнопка "Вперёд"
              </label>
              <input
                type="text"
                value={currentConfig.nextText}
                onChange={(e) => updateConfig({ nextText: e.target.value })}
                placeholder="Вперёд →"
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* Общие настройки */}
      <div className="space-y-3">
        <h5 className="text-sm font-medium text-gray-700">Дополнительно</h5>

        {/* Позиция */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Позиция
          </label>
          <div className="flex gap-2">
            {(['top', 'bottom', 'both'] as const).map(pos => (
              <button
                key={pos}
                onClick={() => updateConfig({ position: pos })}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  currentConfig.position === pos
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {pos === 'top' ? 'Сверху' : pos === 'bottom' ? 'Снизу' : 'Сверху и снизу'}
              </button>
            ))}
          </div>
        </div>

        {/* Показывать общее количество */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="show-total"
            checked={currentConfig.showTotal}
            onChange={(e) => updateConfig({ showTotal: e.target.checked })}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <label htmlFor="show-total" className="text-sm text-gray-700">
            Показывать общее количество записей
          </label>
        </div>

        {/* Выбор размера страницы */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="show-per-page"
            checked={currentConfig.showPerPage}
            onChange={(e) => updateConfig({ showPerPage: e.target.checked })}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <label htmlFor="show-per-page" className="text-sm text-gray-700">
            Показывать выбор количества на странице
          </label>
        </div>

        {currentConfig.showPerPage && (
          <div className="ml-6">
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Варианты
            </label>
            <input
              type="text"
              value={currentConfig.perPageOptions?.join(', ')}
              onChange={(e) => {
                const values = e.target.value.split(',').map(v => parseInt(v.trim())).filter(v => !isNaN(v))
                updateConfig({ perPageOptions: values.length > 0 ? values : [10, 20, 50] })
              }}
              placeholder="10, 20, 50, 100"
              className="w-48 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}
      </div>

      {/* Превью */}
      <div className="mt-4 p-4 border border-gray-200 rounded-lg bg-white">
        <p className="text-xs font-medium text-gray-500 mb-3">Превью:</p>
        <div className="flex items-center justify-between">
          {/* Информация */}
          {currentConfig.showTotal && (
            <span className="text-sm text-gray-500">
              Показано 1-10 из 100
            </span>
          )}

          {/* Пагинация */}
          <div className="flex items-center gap-2">
            {currentConfig.style === 'pages' && (
              <>
                <button className="px-2 py-1 text-sm border rounded hover:bg-gray-50">«</button>
                <button className="px-2 py-1 text-sm border rounded bg-blue-600 text-white">1</button>
                <button className="px-2 py-1 text-sm border rounded hover:bg-gray-50">2</button>
                <button className="px-2 py-1 text-sm border rounded hover:bg-gray-50">3</button>
                <span className="text-gray-400">...</span>
                <button className="px-2 py-1 text-sm border rounded hover:bg-gray-50">10</button>
                <button className="px-2 py-1 text-sm border rounded hover:bg-gray-50">»</button>
              </>
            )}

            {currentConfig.style === 'loadMore' && (
              <button className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg">
                {currentConfig.loadMoreText || 'Загрузить ещё'}
              </button>
            )}

            {currentConfig.style === 'infiniteScroll' && (
              <div className="text-sm text-gray-400 italic">
                Автоматическая загрузка при прокрутке...
              </div>
            )}

            {currentConfig.style === 'prevNext' && (
              <>
                <button className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">
                  {currentConfig.prevText || '← Назад'}
                </button>
                <button className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">
                  {currentConfig.nextText || 'Вперёд →'}
                </button>
              </>
            )}
          </div>

          {/* Per page selector */}
          {currentConfig.showPerPage && (
            <select className="px-2 py-1 text-sm border border-gray-300 rounded">
              {currentConfig.perPageOptions?.map(opt => (
                <option key={opt} value={opt}>{opt} / стр.</option>
              ))}
            </select>
          )}
        </div>
      </div>
    </div>
  )
}
