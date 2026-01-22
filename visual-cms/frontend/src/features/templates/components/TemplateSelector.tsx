/**
 * TemplateSelector Component
 * 
 * Dropdown/modal for selecting a template when configuring Repeater bindings.
 * Shows template preview on hover and filters by category.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import {
  fetchTemplates,
  selectTemplates,
  selectTemplatesLoading,
} from '../templatesSlice';
import { Template, TemplateCategory, TEMPLATE_CATEGORIES } from '../../../shared/types/template';

// Icons
const SearchIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const CheckIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const TemplateIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
  </svg>
);

interface TemplateSelectorProps {
  value?: string | null; // Template ID
  onChange: (templateId: string | null, template?: Template) => void;
  categoryFilter?: TemplateCategory;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  showPreview?: boolean;
}

const TemplateSelector: React.FC<TemplateSelectorProps> = ({
  value,
  onChange,
  categoryFilter,
  placeholder = 'Select template...',
  className = '',
  disabled = false,
  showPreview = true,
}) => {
  const dispatch = useAppDispatch();
  const templates = useAppSelector(selectTemplates);
  const loading = useAppSelector(selectTemplatesLoading);

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory | ''>('');
  const [hoveredTemplate, setHoveredTemplate] = useState<Template | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const previewTimeoutRef = useRef<NodeJS.Timeout>();

  // Load templates
  useEffect(() => {
    dispatch(fetchTemplates({
      status: 'active',
      category: categoryFilter,
    }));
  }, [dispatch, categoryFilter]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter templates
  const filteredTemplates = templates.filter((template) => {
    // Status filter
    if (template.status !== 'active') return false;

    // Category filter from props
    if (categoryFilter && template.category !== categoryFilter) return false;

    // Category filter from dropdown
    if (selectedCategory && template.category !== selectedCategory) return false;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        template.name.toLowerCase().includes(query) ||
        template.description?.toLowerCase().includes(query) ||
        template.tags?.some((tag) => tag.toLowerCase().includes(query))
      );
    }

    return true;
  });

  // Get selected template
  const selectedTemplate = value ? templates.find((t) => t.id === value) : null;

  const handleSelect = useCallback((template: Template) => {
    onChange(template.id, template);
    setIsOpen(false);
    setSearchQuery('');
  }, [onChange]);

  const handleClear = useCallback(() => {
    onChange(null);
    setIsOpen(false);
  }, [onChange]);

  const handleMouseEnter = useCallback((template: Template) => {
    if (!showPreview) return;
    previewTimeoutRef.current = setTimeout(() => {
      setHoveredTemplate(template);
    }, 300);
  }, [showPreview]);

  const handleMouseLeave = useCallback(() => {
    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current);
    }
    setHoveredTemplate(null);
  }, []);

  const getCategoryColor = (category: TemplateCategory): string => {
    const colors: Record<TemplateCategory, string> = {
      card: 'bg-blue-100 text-blue-800',
      'list-item': 'bg-green-100 text-green-800',
      'table-row': 'bg-purple-100 text-purple-800',
      gallery: 'bg-pink-100 text-pink-800',
      testimonial: 'bg-yellow-100 text-yellow-800',
      'team-member': 'bg-indigo-100 text-indigo-800',
      pricing: 'bg-red-100 text-red-800',
      feature: 'bg-cyan-100 text-cyan-800',
      faq: 'bg-orange-100 text-orange-800',
      'blog-post': 'bg-teal-100 text-teal-800',
      custom: 'bg-gray-100 text-gray-800',
    };
    return colors[category] || colors.custom;
  };

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          w-full flex items-center justify-between px-3 py-2 text-left
          border rounded-lg transition-colors
          ${disabled
            ? 'bg-gray-100 border-gray-200 cursor-not-allowed'
            : isOpen
              ? 'border-blue-500 ring-2 ring-blue-200'
              : 'border-gray-300 hover:border-gray-400'
          }
        `}
      >
        <div className="flex items-center gap-2 min-w-0">
          {selectedTemplate ? (
            <>
              <div className="w-8 h-8 bg-gray-100 rounded overflow-hidden flex-shrink-0">
                {selectedTemplate.thumbnail ? (
                  <img
                    src={selectedTemplate.thumbnail}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    <TemplateIcon />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <div className="font-medium text-gray-900 truncate">{selectedTemplate.name}</div>
                <div className="text-xs text-gray-500 truncate">
                  {selectedTemplate.detectedFields?.length || 0} fields
                </div>
              </div>
            </>
          ) : (
            <span className="text-gray-500">{placeholder}</span>
          )}
        </div>
        <ChevronDownIcon />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full min-w-[320px] bg-white border border-gray-200 rounded-lg shadow-lg">
          {/* Search & Filters */}
          <div className="p-3 border-b border-gray-200">
            <div className="relative">
              <SearchIcon />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search templates..."
                className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoFocus
              />
            </div>

            {/* Category Filter */}
            {!categoryFilter && (
              <div className="mt-2 flex flex-wrap gap-1">
                <button
                  onClick={() => setSelectedCategory('')}
                  className={`
                    px-2 py-1 text-xs rounded transition-colors
                    ${!selectedCategory
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}
                  `}
                >
                  All
                </button>
                {(Object.keys(TEMPLATE_CATEGORIES) as TemplateCategory[]).slice(0, 6).map((catKey) => (
                  <button
                    key={catKey}
                    onClick={() => setSelectedCategory(catKey)}
                    className={`
                      px-2 py-1 text-xs rounded transition-colors
                      ${selectedCategory === catKey
                        ? getCategoryColor(catKey)
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}
                    `}
                  >
                    {TEMPLATE_CATEGORIES[catKey].label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Templates List */}
          <div className="max-h-64 overflow-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="py-8 text-center text-gray-500">
                <p className="text-sm">No templates found</p>
              </div>
            ) : (
              <div className="py-1">
                {/* Clear option */}
                {value && (
                  <button
                    onClick={handleClear}
                    className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50 text-gray-500"
                  >
                    <span className="text-sm">Clear selection</span>
                  </button>
                )}

                {/* Template items */}
                {filteredTemplates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => handleSelect(template)}
                    onMouseEnter={() => handleMouseEnter(template)}
                    onMouseLeave={handleMouseLeave}
                    className={`
                      w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-blue-50
                      ${template.id === value ? 'bg-blue-50' : ''}
                    `}
                  >
                    {/* Thumbnail */}
                    <div className="w-10 h-10 bg-gray-100 rounded overflow-hidden flex-shrink-0">
                      {template.thumbnail ? (
                        <img
                          src={template.thumbnail}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          <TemplateIcon />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 truncate">
                          {template.name}
                        </span>
                        {template.isBuiltIn && (
                          <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">
                            Built-in
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span className={`px-1.5 py-0.5 rounded ${getCategoryColor(template.category)}`}>
                          {template.category}
                        </span>
                        <span>{template.detectedFields?.length || 0} fields</span>
                      </div>
                    </div>

                    {/* Selected indicator */}
                    {template.id === value && (
                      <CheckIcon />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Preview Tooltip */}
      {showPreview && hoveredTemplate && isOpen && (
        <div
          className="absolute z-50 left-full ml-2 top-0 w-72 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden"
          onMouseEnter={() => setHoveredTemplate(hoveredTemplate)}
          onMouseLeave={handleMouseLeave}
        >
          {/* Preview Image */}
          <div className="h-32 bg-gray-100">
            {hoveredTemplate.thumbnail ? (
              <img
                src={hoveredTemplate.thumbnail}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                <TemplateIcon />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="p-3">
            <h4 className="font-medium text-gray-900">{hoveredTemplate.name}</h4>
            {hoveredTemplate.description && (
              <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                {hoveredTemplate.description}
              </p>
            )}

            {/* Fields */}
            {hoveredTemplate.detectedFields && hoveredTemplate.detectedFields.length > 0 && (
              <div className="mt-3">
                <h5 className="text-xs font-medium text-gray-700 mb-1">Fields:</h5>
                <div className="flex flex-wrap gap-1">
                  {hoveredTemplate.detectedFields.slice(0, 5).map((field) => (
                    <span
                      key={field.name}
                      className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded"
                    >
                      {field.name}
                    </span>
                  ))}
                  {hoveredTemplate.detectedFields.length > 5 && (
                    <span className="text-xs text-gray-400">
                      +{hoveredTemplate.detectedFields.length - 5} more
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TemplateSelector;
