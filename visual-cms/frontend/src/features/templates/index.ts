/**
 * Templates Feature
 * 
 * Согласно ТЗ: docs/data-binding-system-spec.md
 * Этап 3: Templates System
 */

// Slice exports
export { 
  default as templatesReducer,
  fetchTemplates,
  fetchTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  duplicateTemplate,
  detectTemplateFields,
  detectFieldsFromHtml,
  setCurrentTemplate,
  setFilters,
  clearFilters,
  clearError,
  updateCurrentTemplateFields,
  selectTemplates,
  selectCurrentTemplate,
  selectTemplatesLoading,
  selectTemplatesSaving,
  selectTemplatesDetecting,
  selectTemplatesError,
  selectTemplatesFilters,
  selectTemplatesByCategory,
  selectActiveTemplates,
} from './templatesSlice'

// Component exports
export {
  TemplatesList,
  TemplateEditor,
  TemplatePreview,
  TemplateFieldsDetector,
  TemplateSelector,
} from './components'

// Hook exports
export { useTemplate } from './hooks/useTemplate'

// Type re-exports
export type { 
  Template, 
  CreateTemplateRequest, 
  UpdateTemplateRequest,
  TemplateFilters,
  TemplateCategory,
  TemplateStatus,
  DetectedField,
  DetectedFieldType,
  TemplateSettings
} from '@/shared/types/template'
