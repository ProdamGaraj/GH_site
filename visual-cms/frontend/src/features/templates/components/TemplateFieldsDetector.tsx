/**
 * TemplateFieldsDetector Component
 * 
 * Displays and manages detected fields from template HTML.
 * Allows manual editing of field types and properties.
 */

import React, { useCallback, useState } from 'react';
import { DetectedField, DetectedFieldType, FIELD_TYPES } from '../../../shared/types/template';
import { Button } from '../../../shared/components/Button';

// Icons
const DetectIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
  </svg>
);

const AddIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

const TrashIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

const InfoIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

interface TemplateFieldsDetectorProps {
  fields: DetectedField[];
  onChange: (fields: DetectedField[]) => void;
  htmlContent: string;
  onDetect: () => void;
  detecting: boolean;
}

const TemplateFieldsDetector: React.FC<TemplateFieldsDetectorProps> = ({
  fields,
  onChange,
  htmlContent,
  onDetect,
  detecting,
}) => {
  const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set());
  const [newFieldName, setNewFieldName] = useState('');

  const toggleExpand = useCallback((fieldName: string) => {
    setExpandedFields((prev) => {
      const next = new Set(prev);
      if (next.has(fieldName)) {
        next.delete(fieldName);
      } else {
        next.add(fieldName);
      }
      return next;
    });
  }, []);

  const handleFieldUpdate = useCallback(
    (index: number, updates: Partial<DetectedField>) => {
      const newFields = [...fields];
      newFields[index] = { ...newFields[index], ...updates };
      onChange(newFields);
    },
    [fields, onChange]
  );

  const handleDeleteField = useCallback(
    (index: number) => {
      const newFields = fields.filter((_, i) => i !== index);
      onChange(newFields);
    },
    [fields, onChange]
  );

  const handleAddField = useCallback(() => {
    if (!newFieldName.trim()) return;
    
    const name = newFieldName.trim().replace(/\s+/g, '_').toLowerCase();
    
    // Check for duplicates
    if (fields.some((f) => f.name === name)) {
      alert('Field with this name already exists');
      return;
    }

    const newField: DetectedField = {
      id: `field-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name,
      type: 'text',
      selector: `[data-bind="${name}"]`,
      required: false,
    };

    onChange([...fields, newField]);
    setNewFieldName('');
  }, [newFieldName, fields, onChange]);

  const getFieldTypeIcon = (type: DetectedFieldType): string => {
    const icons: Record<DetectedFieldType, string> = {
      text: '📝',
      richText: '📄',
      image: '🖼️',
      link: '🔗',
      number: '#️⃣',
      date: '📅',
      boolean: '✅',
      list: '📋',
      object: '📦',
    };
    return icons[type] || '📝';
  };

  const getFieldTypeLabel = (type: DetectedFieldType): string => {
    const fieldType = FIELD_TYPES[type];
    return fieldType?.label || type;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Detected Fields</h3>
          <p className="text-sm text-gray-500">
            Fields found in HTML that can be bound to data
          </p>
        </div>
        <Button
          onClick={onDetect}
          disabled={detecting || !htmlContent.trim()}
          variant="secondary"
          className="flex items-center gap-2"
        >
          <DetectIcon />
          {detecting ? 'Detecting...' : 'Re-detect'}
        </Button>
      </div>

      {/* Info Banner */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg">
        <InfoIcon />
        <div className="text-sm text-blue-800">
          <p className="font-medium">How field detection works:</p>
          <ul className="mt-1 list-disc list-inside space-y-1 text-blue-700">
            <li>Elements with <code className="bg-blue-100 px-1">data-bind="fieldName"</code> attributes</li>
            <li>Images (<code className="bg-blue-100 px-1">&lt;img&gt;</code>) with meaningful src or alt</li>
            <li>Links (<code className="bg-blue-100 px-1">&lt;a&gt;</code>) with href attributes</li>
            <li>Headings, paragraphs, and semantic elements</li>
            <li>Elements with semantic class names (e.g., .title, .price)</li>
          </ul>
        </div>
      </div>

      {/* Fields List */}
      {fields.length > 0 ? (
        <div className="space-y-2">
          {fields.map((field, index) => (
            <div
              key={field.name}
              className="bg-white border border-gray-200 rounded-lg overflow-hidden"
            >
              {/* Field Header */}
              <div
                className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50"
                onClick={() => toggleExpand(field.name)}
              >
                <span className="text-xl">{getFieldTypeIcon(field.type)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{field.name}</span>
                    {field.required && (
                      <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-xs rounded">
                        Required
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-500 truncate">
                    {getFieldTypeLabel(field.type)} • {field.selector}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteField(index);
                  }}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                >
                  <TrashIcon />
                </button>
                {expandedFields.has(field.name) ? <ChevronDownIcon /> : <ChevronRightIcon />}
              </div>

              {/* Field Details (Expanded) */}
              {expandedFields.has(field.name) && (
                <div className="p-4 border-t border-gray-200 bg-gray-50 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    {/* Field Name */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Field Name
                      </label>
                      <input
                        type="text"
                        value={field.name}
                        onChange={(e) => handleFieldUpdate(index, { name: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* Field Type */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Field Type
                      </label>
                      <select
                        value={field.type}
                        onChange={(e) => handleFieldUpdate(index, { type: e.target.value as DetectedFieldType })}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                      >
                        {(Object.keys(FIELD_TYPES) as DetectedFieldType[]).map((typeKey) => (
                          <option key={typeKey} value={typeKey}>
                            {FIELD_TYPES[typeKey].label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* CSS Selector */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      CSS Selector
                    </label>
                    <input
                      type="text"
                      value={field.selector}
                      onChange={(e) => handleFieldUpdate(index, { selector: e.target.value })}
                      placeholder="e.g., [data-bind='title'], .card-title"
                      className="w-full px-3 py-2 text-sm font-mono border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Default Value */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Default Value
                    </label>
                    {field.type === 'text' || field.type === 'link' || field.type === 'image' ? (
                      <input
                        type="text"
                        value={(field.defaultValue as string) || ''}
                        onChange={(e) => handleFieldUpdate(index, { defaultValue: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                      />
                    ) : field.type === 'richText' ? (
                      <textarea
                        value={(field.defaultValue as string) || ''}
                        onChange={(e) => handleFieldUpdate(index, { defaultValue: e.target.value })}
                        rows={3}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                      />
                    ) : field.type === 'number' ? (
                      <input
                        type="number"
                        value={(field.defaultValue as number) || 0}
                        onChange={(e) => handleFieldUpdate(index, { defaultValue: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                      />
                    ) : field.type === 'boolean' ? (
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={Boolean(field.defaultValue)}
                          onChange={(e) => handleFieldUpdate(index, { defaultValue: e.target.checked })}
                          className="w-4 h-4 rounded border-gray-300"
                        />
                        <span className="text-sm text-gray-600">Default enabled</span>
                      </label>
                    ) : (
                      <input
                        type="text"
                        value={JSON.stringify(field.defaultValue || '')}
                        onChange={(e) => {
                          try {
                            handleFieldUpdate(index, { defaultValue: JSON.parse(e.target.value) });
                          } catch {
                            // Invalid JSON, ignore
                          }
                        }}
                        className="w-full px-3 py-2 text-sm font-mono border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                      />
                    )}
                  </div>

                  {/* Options row */}
                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={field.required || false}
                        onChange={(e) => handleFieldUpdate(index, { required: e.target.checked })}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600"
                      />
                      <span className="text-sm text-gray-700">Required field</span>
                    </label>

                    {/* Validation pattern for text fields */}
                    {(field.type === 'text' || field.type === 'link') && (
                      <div className="flex-1">
                        <label className="text-sm text-gray-600 mr-2">Validation:</label>
                        <input
                          type="text"
                          value={field.validation?.pattern || ''}
                          onChange={(e) => handleFieldUpdate(index, {
                            validation: { ...field.validation, pattern: e.target.value || undefined }
                          })}
                          placeholder="regex pattern"
                          className="px-2 py-1 text-sm font-mono border border-gray-300 rounded w-40"
                        />
                      </div>
                    )}

                    {/* Min/Max for numbers */}
                    {field.type === 'number' && (
                      <>
                        <div>
                          <label className="text-sm text-gray-600 mr-2">Min:</label>
                          <input
                            type="number"
                            value={field.validation?.min ?? ''}
                            onChange={(e) => handleFieldUpdate(index, {
                              validation: { ...field.validation, min: e.target.value ? parseFloat(e.target.value) : undefined }
                            })}
                            className="px-2 py-1 text-sm border border-gray-300 rounded w-20"
                          />
                        </div>
                        <div>
                          <label className="text-sm text-gray-600 mr-2">Max:</label>
                          <input
                            type="number"
                            value={field.validation?.max ?? ''}
                            onChange={(e) => handleFieldUpdate(index, {
                              validation: { ...field.validation, max: e.target.value ? parseFloat(e.target.value) : undefined }
                            })}
                            className="px-2 py-1 text-sm border border-gray-300 rounded w-20"
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <div className="text-4xl mb-4">🔍</div>
          <p className="text-gray-600 mb-2">No fields detected yet</p>
          <p className="text-sm text-gray-500 mb-4">
            Click "Re-detect" to scan your HTML for bindable fields
          </p>
          <Button onClick={onDetect} disabled={detecting || !htmlContent.trim()}>
            {detecting ? 'Detecting...' : 'Detect Fields'}
          </Button>
        </div>
      )}

      {/* Add Manual Field */}
      <div className="pt-4 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Add Custom Field</h4>
        <div className="flex gap-2">
          <input
            type="text"
            value={newFieldName}
            onChange={(e) => setNewFieldName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddField()}
            placeholder="Field name (e.g., subtitle)"
            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
          />
          <Button onClick={handleAddField} variant="secondary" className="flex items-center gap-2">
            <AddIcon />
            Add
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TemplateFieldsDetector;
