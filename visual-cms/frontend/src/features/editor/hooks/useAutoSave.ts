/**
 * Auto-save hook for Visual Editor
 * 
 * Автоматически сохраняет изменения в редакторе
 */

import { useEffect, useRef, useCallback, useState } from 'react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { selectRootNode, selectIsDirty, selectBreakpoints, markAsSaved } from '@/features/editor/editorSlice'
import { updatePage } from '@/features/pages/pagesSlice'
import { updateBlock } from '@/features/blocks/blocksSlice'
import type { BlockNode, EditorPageSettings } from '@/shared/types'

interface UseAutoSaveOptions {
  /** ID документа (страницы или блока) */
  documentId: string | null
  /** Тип документа */
  documentType: 'page' | 'block'
  /** Настройки страницы (для page типа) */
  pageSettings?: EditorPageSettings
  /** Включено ли автосохранение */
  enabled?: boolean
  /** Интервал между сохранениями (мс) */
  debounceMs?: number
  /** Callback после успешного сохранения */
  onSaveSuccess?: () => void
  /** Callback при ошибке */
  onSaveError?: (error: Error) => void
}

interface AutoSaveState {
  /** Последнее время сохранения */
  lastSavedAt: Date | null
  /** Идёт ли сохранение */
  isSaving: boolean
  /** Ошибка сохранения */
  error: string | null
  /** Есть ли несохранённые изменения */
  hasUnsavedChanges: boolean
}

/**
 * Хук для автоматического сохранения изменений в редакторе
 */
export function useAutoSave({
  documentId,
  documentType,
  pageSettings,
  enabled = true,
  debounceMs = 3000,
  onSaveSuccess,
  onSaveError,
}: UseAutoSaveOptions) {
  const dispatch = useAppDispatch()
  const rootNode = useAppSelector(selectRootNode)
  const isDirty = useAppSelector(selectIsDirty)
  const breakpoints = useAppSelector(selectBreakpoints)
  
  const [state, setState] = useState<AutoSaveState>({
    lastSavedAt: null,
    isSaving: false,
    error: null,
    hasUnsavedChanges: false,
  })
  
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastSavedStructureRef = useRef<string | null>(null)
  
  // Сериализуем структуру для сравнения
  const serializeNode = useCallback((node: BlockNode | null): string => {
    if (!node) return ''
    return JSON.stringify(node)
  }, [])
  
  // Функция сохранения
  const saveDocument = useCallback(async () => {
    if (!documentId || !rootNode) return
    
    const currentStructure = serializeNode(rootNode)
    
    // Если структура не изменилась - не сохраняем
    if (currentStructure === lastSavedStructureRef.current) {
      return
    }
    
    setState(prev => ({ ...prev, isSaving: true, error: null }))
    
    try {
      if (documentType === 'page' && pageSettings) {
        // Inject breakpoints into root metadata (same as handleSave)
        const structureWithBreakpoints = {
          ...rootNode,
          metadata: {
            ...rootNode.metadata,
            breakpoints: breakpoints.map(bp => ({ id: bp.id, name: bp.name, width: bp.width, height: bp.height })),
          },
        }
        await dispatch(updatePage({
          id: documentId,
          data: {
            structure: structureWithBreakpoints,
            name: pageSettings.name,
            slug: pageSettings.slug,
            status: pageSettings.status,
            metadata: {
              title: pageSettings.metaTitle || undefined,
              description: pageSettings.metaDescription || undefined,
              keywords: pageSettings.keywords ? pageSettings.keywords.split(',').map(k => k.trim()) : [],
              ogImage: pageSettings.ogImage || undefined,
            }
          }
        })).unwrap()
      } else if (documentType === 'block') {
        await dispatch(updateBlock({
          id: documentId,
          data: {
            structure: rootNode,
          }
        })).unwrap()
      }
      
      // Успешное сохранение
      dispatch(markAsSaved())
      lastSavedStructureRef.current = currentStructure
      
      setState(prev => ({
        ...prev,
        isSaving: false,
        lastSavedAt: new Date(),
        hasUnsavedChanges: false,
        error: null,
      }))
      
      onSaveSuccess?.()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save'
      
      setState(prev => ({
        ...prev,
        isSaving: false,
        error: errorMessage,
      }))
      
      onSaveError?.(error instanceof Error ? error : new Error(errorMessage))
    }
  }, [documentId, documentType, rootNode, breakpoints, pageSettings, dispatch, serializeNode, onSaveSuccess, onSaveError])
  
  // Обновляем состояние hasUnsavedChanges
  useEffect(() => {
    setState(prev => ({
      ...prev,
      hasUnsavedChanges: isDirty,
    }))
  }, [isDirty])
  
  // Debounced auto-save при изменениях
  useEffect(() => {
    if (!enabled || !documentId || !isDirty) return
    
    // Очищаем предыдущий таймер
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    
    // Устанавливаем новый таймер для сохранения
    saveTimeoutRef.current = setTimeout(() => {
      saveDocument()
    }, debounceMs)
    
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [enabled, documentId, isDirty, rootNode, debounceMs, saveDocument])
  
  // Сохраняем при закрытии страницы
  useEffect(() => {
    if (!enabled || !documentId) return
    
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        // Попытка синхронного сохранения
        saveDocument()
        
        // Показываем предупреждение браузера
        e.preventDefault()
        e.returnValue = 'У вас есть несохранённые изменения. Вы уверены, что хотите покинуть страницу?'
        return e.returnValue
      }
    }
    
    window.addEventListener('beforeunload', handleBeforeUnload)
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [enabled, documentId, isDirty, saveDocument])
  
  // Ручное сохранение
  const save = useCallback(async () => {
    await saveDocument()
  }, [saveDocument])
  
  // Форматирование времени последнего сохранения
  const getLastSavedText = useCallback((): string => {
    if (!state.lastSavedAt) return ''
    
    const now = new Date()
    const diff = now.getTime() - state.lastSavedAt.getTime()
    
    if (diff < 60000) {
      return 'Сохранено только что'
    } else if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000)
      return `Сохранено ${minutes} мин. назад`
    } else {
      return `Сохранено в ${state.lastSavedAt.toLocaleTimeString()}`
    }
  }, [state.lastSavedAt])
  
  return {
    ...state,
    save,
    getLastSavedText,
  }
}

export type { UseAutoSaveOptions, AutoSaveState }
