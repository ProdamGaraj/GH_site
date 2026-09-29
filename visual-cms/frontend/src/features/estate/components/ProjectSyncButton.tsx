import React from 'react'
import { RefreshCw } from 'lucide-react'
import { cn } from '@/shared/utils'
import { whyProjectSyncDisabled } from '../macroSync'
import { useMacroSync } from '../useMacroSync'

/**
 * «Синхронизировать проект»: тот же прогон MacroCRM, что в списке ЖК, но
 * только по дому этого проекта. После прогона коллекция пересобирается сама
 * (бэкенд), а редактор подтягивает свежие данные — `onFinished`.
 */
export const ProjectSyncButton: React.FC<{
  externalHouseId: number | null | undefined
  onFinished?: () => void
}> = ({ externalHouseId, onFinished }) => {
  const { state, busy, error, starting, running, start } = useMacroSync(onFinished)
  const reason = whyProjectSyncDisabled(state, busy, starting, externalHouseId)
  const enabled = !reason

  return (
    <div className="flex items-center gap-2">
      {error && (
        <span className="text-xs text-red-600 max-w-[16rem] truncate" title={error}>
          {error}
        </span>
      )}
      <button
        type="button"
        onClick={() => externalHouseId && start({ externalHouseIds: [externalHouseId] })}
        disabled={!enabled}
        title={reason || 'Квартиры, планировки и картинки этого проекта из MacroCRM'}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-md text-sm border',
          enabled
            ? 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            : 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
        )}
      >
        <RefreshCw size={16} className={running ? 'animate-spin' : undefined} />
        {running ? 'Синхронизация идёт…' : 'Синхронизировать проект'}
      </button>
    </div>
  )
}
