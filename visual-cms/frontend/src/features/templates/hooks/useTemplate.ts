/**
 * useTemplate Hook
 * 
 * Provides convenient access to template functionality:
 * - Loading and caching templates
 * - Applying templates to data
 * - Rendering template HTML with bound data
 */

import { useCallback, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import {
  fetchTemplates,
  fetchTemplateById,
  selectTemplates,
  selectCurrentTemplate,
  selectTemplatesLoading,
} from '../templatesSlice';
import { Template, DetectedField } from '../../../shared/types/template';

interface UseTemplateOptions {
  autoLoad?: boolean;
}

interface UseTemplateReturn {
  // State
  templates: Template[];
  currentTemplate: Template | null;
  loading: boolean;
  
  // Actions
  loadTemplates: () => Promise<void>;
  loadTemplate: (id: string) => Promise<Template | null>;
  getTemplateById: (id: string) => Template | undefined;
  
  // Rendering
  renderTemplate: (template: Template, data: Record<string, unknown>) => string;
  renderTemplateById: (templateId: string, data: Record<string, unknown>) => string | null;
  
  // Field operations
  getTemplateFields: (template: Template) => DetectedField[];
  validateData: (template: Template, data: Record<string, unknown>) => ValidationResult;
  generateDefaultData: (template: Template) => Record<string, unknown>;
}

interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

interface ValidationError {
  field: string;
  message: string;
  type: 'required' | 'type' | 'validation';
}

export const useTemplate = (_options: UseTemplateOptions = {}): UseTemplateReturn => {
  const dispatch = useAppDispatch();
  const templates = useAppSelector(selectTemplates);
  const currentTemplate = useAppSelector(selectCurrentTemplate);
  const loading = useAppSelector(selectTemplatesLoading);

  // Load all templates
  const loadTemplates = useCallback(async () => {
    await dispatch(fetchTemplates({}));
  }, [dispatch]);

  // Load single template
  const loadTemplate = useCallback(async (id: string): Promise<Template | null> => {
    const result = await dispatch(fetchTemplateById(id));
    if (fetchTemplateById.fulfilled.match(result)) {
      return result.payload;
    }
    return null;
  }, [dispatch]);

  // Get template by ID from loaded templates
  const getTemplateById = useCallback((id: string): Template | undefined => {
    return templates.find((t) => t.id === id);
  }, [templates]);

  // Render template with data
  const renderTemplate = useCallback((template: Template, data: Record<string, unknown>): string => {
    if (!template.htmlContent) return '';

    let html = template.htmlContent;

    // Replace data-bind attributes with actual values
    Object.entries(data).forEach(([key, value]) => {
      if (value === undefined || value === null) return;

      const strValue = typeof value === 'object' ? JSON.stringify(value) : String(value);

      // For images: replace src attribute
      const imgRegex = new RegExp(
        `(<img[^>]*data-bind=["']${key}["'][^>]*)(src=["'][^"']*["'])`,
        'gi'
      );
      html = html.replace(imgRegex, `$1src="${strValue}"`);

      // For links: replace href attribute
      const linkRegex = new RegExp(
        `(<a[^>]*data-bind=["']${key}["'][^>]*)(href=["'][^"']*["'])`,
        'gi'
      );
      html = html.replace(linkRegex, `$1href="${strValue}"`);

      // For general elements: replace inner content
      // Match opening tag with data-bind, content, and closing tag
      const contentRegex = new RegExp(
        `(<[a-z][a-z0-9]*[^>]*data-bind=["']${key}["'][^>]*>)([\\s\\S]*?)(<\\/[a-z][a-z0-9]*>)`,
        'gi'
      );
      html = html.replace(contentRegex, (match, openTag, _content, closeTag) => {
        // Avoid replacing if this element contains nested data-bind elements
        if (_content.includes('data-bind=')) {
          return match;
        }
        return `${openTag}${strValue}${closeTag}`;
      });
    });

    return html;
  }, []);

  // Render template by ID
  const renderTemplateById = useCallback(
    (templateId: string, data: Record<string, unknown>): string | null => {
      const template = getTemplateById(templateId);
      if (!template) return null;
      return renderTemplate(template, data);
    },
    [getTemplateById, renderTemplate]
  );

  // Get template fields
  const getTemplateFields = useCallback((template: Template): DetectedField[] => {
    return template.detectedFields || [];
  }, []);

  // Validate data against template fields
  const validateData = useCallback(
    (template: Template, data: Record<string, unknown>): ValidationResult => {
      const errors: ValidationError[] = [];
      const fields = template.detectedFields || [];

      for (const field of fields) {
        const value = data[field.name];

        // Required check
        if (field.required && (value === undefined || value === null || value === '')) {
          errors.push({
            field: field.name,
            message: `${field.name} is required`,
            type: 'required',
          });
          continue;
        }

        // Skip further validation if value is empty and not required
        if (value === undefined || value === null || value === '') {
          continue;
        }

        // Type check
        const typeValid = validateFieldType(field, value);
        if (!typeValid) {
          errors.push({
            field: field.name,
            message: `${field.name} must be of type ${field.type}`,
            type: 'type',
          });
          continue;
        }

        // Validation rules
        if (field.validation) {
          // Pattern validation
          if (field.validation.pattern && typeof value === 'string') {
            const regex = new RegExp(field.validation.pattern);
            if (!regex.test(value)) {
              errors.push({
                field: field.name,
                message: `${field.name} does not match the required pattern`,
                type: 'validation',
              });
            }
          }

          // Min/max validation for numbers
          if (field.type === 'number' && typeof value === 'number') {
            if (field.validation.min !== undefined && value < field.validation.min) {
              errors.push({
                field: field.name,
                message: `${field.name} must be at least ${field.validation.min}`,
                type: 'validation',
              });
            }
            if (field.validation.max !== undefined && value > field.validation.max) {
              errors.push({
                field: field.name,
                message: `${field.name} must be at most ${field.validation.max}`,
                type: 'validation',
              });
            }
          }

          // Min/max length validation for strings
          if ((field.type === 'text' || field.type === 'richText') && typeof value === 'string') {
            if (field.validation.minLength !== undefined && value.length < field.validation.minLength) {
              errors.push({
                field: field.name,
                message: `${field.name} must be at least ${field.validation.minLength} characters`,
                type: 'validation',
              });
            }
            if (field.validation.maxLength !== undefined && value.length > field.validation.maxLength) {
              errors.push({
                field: field.name,
                message: `${field.name} must be at most ${field.validation.maxLength} characters`,
                type: 'validation',
              });
            }
          }
        }
      }

      return {
        valid: errors.length === 0,
        errors,
      };
    },
    []
  );

  // Generate default data from template fields
  const generateDefaultData = useCallback((template: Template): Record<string, unknown> => {
    const data: Record<string, unknown> = {};
    const fields = template.detectedFields || [];

    for (const field of fields) {
      if (field.defaultValue !== undefined) {
        data[field.name] = field.defaultValue;
      } else {
        // Generate placeholder values based on type
        switch (field.type) {
          case 'text':
            data[field.name] = `Sample ${field.name}`;
            break;
          case 'richText':
            data[field.name] = `<p>Sample ${field.name} content</p>`;
            break;
          case 'image':
            data[field.name] = 'https://via.placeholder.com/300x200';
            break;
          case 'link':
            data[field.name] = '#';
            break;
          case 'number':
            data[field.name] = 0;
            break;
          case 'date':
            data[field.name] = new Date().toISOString().split('T')[0];
            break;
          case 'boolean':
            data[field.name] = true;
            break;
          case 'list':
            data[field.name] = [];
            break;
          case 'object':
            data[field.name] = {};
            break;
          default:
            data[field.name] = '';
        }
      }
    }

    return data;
  }, []);

  return useMemo(() => ({
    templates,
    currentTemplate,
    loading,
    loadTemplates,
    loadTemplate,
    getTemplateById,
    renderTemplate,
    renderTemplateById,
    getTemplateFields,
    validateData,
    generateDefaultData,
  }), [
    templates,
    currentTemplate,
    loading,
    loadTemplates,
    loadTemplate,
    getTemplateById,
    renderTemplate,
    renderTemplateById,
    getTemplateFields,
    validateData,
    generateDefaultData,
  ]);
};

// Helper function to validate field type
function validateFieldType(field: DetectedField, value: unknown): boolean {
  switch (field.type) {
    case 'text':
    case 'richText':
    case 'image':
    case 'link':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && !isNaN(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'date':
      if (typeof value === 'string') {
        const date = new Date(value);
        return !isNaN(date.getTime());
      }
      return value instanceof Date;
    case 'list':
      return Array.isArray(value);
    case 'object':
      return typeof value === 'object' && value !== null && !Array.isArray(value);
    default:
      return true;
  }
}

export default useTemplate;
