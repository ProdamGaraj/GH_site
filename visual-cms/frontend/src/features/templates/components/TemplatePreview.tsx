/**
 * TemplatePreview Component
 * 
 * Renders a live preview of the template with test data.
 * Allows editing preview data to test different scenarios.
 */

import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { DetectedField } from '../../../shared/types/template';

// Icons
const RefreshIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const ExpandIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
  </svg>
);

const EditIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

interface TemplatePreviewProps {
  htmlContent: string;
  cssContent: string;
  fields: DetectedField[];
  data: Record<string, unknown>;
  onDataChange?: (data: Record<string, unknown>) => void;
  readOnly?: boolean;
}

const TemplatePreview: React.FC<TemplatePreviewProps> = ({
  htmlContent,
  cssContent,
  fields,
  data,
  onDataChange,
  readOnly = false,
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [showDataEditor, setShowDataEditor] = useState(false);
  const [dataJson, setDataJson] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Generate default data from fields
  const generateDefaultData = useCallback((): Record<string, unknown> => {
    const defaultData: Record<string, unknown> = {};
    
    fields.forEach((field) => {
      switch (field.type) {
        case 'text':
          defaultData[field.name] = field.defaultValue || `Sample ${field.name}`;
          break;
        case 'richText':
          defaultData[field.name] = field.defaultValue || `<p>Sample rich text for ${field.name}</p>`;
          break;
        case 'image':
          defaultData[field.name] = field.defaultValue || 'https://via.placeholder.com/300x200';
          break;
        case 'link':
          defaultData[field.name] = field.defaultValue || '#';
          break;
        case 'number':
          defaultData[field.name] = field.defaultValue ?? 0;
          break;
        case 'date':
          defaultData[field.name] = field.defaultValue || new Date().toISOString().split('T')[0];
          break;
        case 'boolean':
          defaultData[field.name] = field.defaultValue ?? true;
          break;
        case 'list':
          defaultData[field.name] = field.defaultValue || [];
          break;
        case 'object':
          defaultData[field.name] = field.defaultValue || {};
          break;
        default:
          defaultData[field.name] = field.defaultValue || '';
      }
    });
    
    return defaultData;
  }, [fields]);

  // Merge provided data with defaults
  const previewData = useMemo(() => {
    const defaults = generateDefaultData();
    return { ...defaults, ...data };
  }, [generateDefaultData, data]);

  // Apply data bindings to HTML
  const processedHtml = useMemo(() => {
    let html = htmlContent;

    // Replace data-bind attributes with actual values
    Object.entries(previewData).forEach(([key, value]) => {
      // For images, replace src
      const imgRegex = new RegExp(`(<img[^>]*data-bind=["']${key}["'][^>]*)(src=["'][^"']*["'])`, 'gi');
      html = html.replace(imgRegex, `$1src="${value}"`);
      
      // For links, replace href
      const linkRegex = new RegExp(`(<a[^>]*data-bind=["']${key}["'][^>]*)(href=["'][^"']*["'])`, 'gi');
      html = html.replace(linkRegex, `$1href="${value}"`);
      
      // For other elements, replace inner content
      // This is a simplified approach - in production you'd use a proper HTML parser
      const contentRegex = new RegExp(
        `(<[^>]+data-bind=["']${key}["'][^>]*>)([^<]*)(<\/[^>]+>)`,
        'gi'
      );
      html = html.replace(contentRegex, (_, open, _oldContent, close) => {
        return `${open}${value}${close}`;
      });
    });

    return html;
  }, [htmlContent, previewData]);

  // Generate full preview HTML document
  const previewDocument = useMemo(() => {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      padding: 20px;
      background: #f5f5f5;
    }
    ${cssContent}
  </style>
</head>
<body>
  ${processedHtml}
</body>
</html>`;
  }, [processedHtml, cssContent]);

  // Update iframe content
  useEffect(() => {
    if (iframeRef.current) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(previewDocument);
        doc.close();
      }
    }
  }, [previewDocument]);

  // Update JSON editor when data changes
  useEffect(() => {
    setDataJson(JSON.stringify(previewData, null, 2));
  }, [previewData]);

  const handleDataJsonChange = useCallback((newJson: string) => {
    setDataJson(newJson);
    setJsonError(null);
    
    try {
      const parsed = JSON.parse(newJson);
      onDataChange?.(parsed);
    } catch (e) {
      setJsonError((e as Error).message);
    }
  }, [onDataChange]);

  const handleResetData = useCallback(() => {
    const defaults = generateDefaultData();
    onDataChange?.(defaults);
    setDataJson(JSON.stringify(defaults, null, 2));
    setJsonError(null);
  }, [generateDefaultData, onDataChange]);

  const handleFieldChange = useCallback((fieldName: string, value: unknown) => {
    const newData = { ...previewData, [fieldName]: value };
    onDataChange?.(newData);
  }, [previewData, onDataChange]);

  return (
    <div className={`flex flex-col h-full ${isFullscreen ? 'fixed inset-0 z-50 bg-white' : ''}`}>
      {/* Toolbar */}
      <div className="flex-shrink-0 flex items-center justify-between p-3 bg-white border-b border-gray-200">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">Preview</span>
          {fields.length > 0 && (
            <span className="text-xs text-gray-500">
              {fields.length} bindable field{fields.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!readOnly && (
            <>
              <button
                onClick={() => setShowDataEditor(!showDataEditor)}
                className={`
                  flex items-center gap-1 px-3 py-1.5 text-sm rounded transition-colors
                  ${showDataEditor 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'text-gray-600 hover:bg-gray-100'}
                `}
              >
                <EditIcon />
                Edit Data
              </button>
              <button
                onClick={handleResetData}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded"
              >
                <RefreshIcon />
                Reset
              </button>
            </>
          )}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded"
          >
            <ExpandIcon />
            {isFullscreen ? 'Exit' : 'Fullscreen'}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Preview iframe */}
        <div className={`${showDataEditor ? 'w-2/3' : 'w-full'} h-full bg-gray-100 p-4`}>
          <div className="h-full bg-white rounded-lg shadow-sm overflow-hidden">
            <iframe
              ref={iframeRef}
              title="Template Preview"
              className="w-full h-full border-none"
              sandbox="allow-same-origin"
            />
          </div>
        </div>

        {/* Data Editor Panel */}
        {showDataEditor && (
          <div className="w-1/3 h-full border-l border-gray-200 flex flex-col bg-white">
            <div className="flex-shrink-0 p-3 border-b border-gray-200">
              <h3 className="font-medium text-gray-900">Preview Data</h3>
              <p className="text-xs text-gray-500 mt-1">Edit values to test different scenarios</p>
            </div>

            {/* Field Inputs */}
            <div className="flex-1 overflow-auto p-3 space-y-4">
              {fields.length > 0 ? (
                <>
                  {/* Simple field editors */}
                  {fields.map((field) => (
                    <div key={field.name}>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {field.name}
                        <span className="ml-2 text-xs text-gray-400">{field.type}</span>
                      </label>
                      {field.type === 'text' && (
                        <input
                          type="text"
                          value={(previewData[field.name] as string) || ''}
                          onChange={(e) => handleFieldChange(field.name, e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                        />
                      )}
                      {field.type === 'richText' && (
                        <textarea
                          value={(previewData[field.name] as string) || ''}
                          onChange={(e) => handleFieldChange(field.name, e.target.value)}
                          rows={3}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                        />
                      )}
                      {field.type === 'image' && (
                        <input
                          type="url"
                          value={(previewData[field.name] as string) || ''}
                          onChange={(e) => handleFieldChange(field.name, e.target.value)}
                          placeholder="https://..."
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                        />
                      )}
                      {field.type === 'link' && (
                        <input
                          type="url"
                          value={(previewData[field.name] as string) || ''}
                          onChange={(e) => handleFieldChange(field.name, e.target.value)}
                          placeholder="https://..."
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                        />
                      )}
                      {field.type === 'number' && (
                        <input
                          type="number"
                          value={(previewData[field.name] as number) || 0}
                          onChange={(e) => handleFieldChange(field.name, parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                        />
                      )}
                      {field.type === 'boolean' && (
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={Boolean(previewData[field.name])}
                            onChange={(e) => handleFieldChange(field.name, e.target.checked)}
                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-600">Enabled</span>
                        </label>
                      )}
                      {field.type === 'date' && (
                        <input
                          type="date"
                          value={(previewData[field.name] as string) || ''}
                          onChange={(e) => handleFieldChange(field.name, e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                        />
                      )}
                    </div>
                  ))}

                  {/* Raw JSON editor */}
                  <details className="pt-4 border-t border-gray-200">
                    <summary className="text-sm font-medium text-gray-700 cursor-pointer">
                      Raw JSON Editor
                    </summary>
                    <div className="mt-2">
                      <textarea
                        value={dataJson}
                        onChange={(e) => handleDataJsonChange(e.target.value)}
                        rows={10}
                        className={`
                          w-full px-3 py-2 font-mono text-xs border rounded
                          ${jsonError 
                            ? 'border-red-300 bg-red-50' 
                            : 'border-gray-300 bg-gray-50'}
                          focus:ring-2 focus:ring-blue-500
                        `}
                      />
                      {jsonError && (
                        <p className="mt-1 text-xs text-red-600">{jsonError}</p>
                      )}
                    </div>
                  </details>
                </>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-sm">No bindable fields detected.</p>
                  <p className="text-xs mt-1">
                    Add <code className="bg-gray-100 px-1">data-bind="fieldName"</code> attributes to your HTML.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TemplatePreview;
