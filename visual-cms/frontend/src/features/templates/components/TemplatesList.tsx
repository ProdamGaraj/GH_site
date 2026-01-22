/**
 * TemplatesList Component
 * 
 * Displays a list of all templates with filtering, search, and actions.
 * Part of the Templates System (Этап 3 from ТЗ).
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import {
  fetchTemplates,
  deleteTemplate,
  duplicateTemplate,
  setFilters,
  clearFilters,
  selectTemplates,
  selectTemplatesLoading,
  selectTemplatesFilters,
} from '../templatesSlice';
import { Template, TemplateCategory, TemplateStatus, TEMPLATE_CATEGORIES } from '../../../shared/types/template';
import { Button } from '../../../shared/components/Button';

// Icons
const PlusIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

const SearchIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const FilterIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
  </svg>
);

const DuplicateIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);

const EditIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

const TrashIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const GridIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
  </svg>
);

const ListIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
  </svg>
);

interface TemplatesListProps {
  onCreateNew?: () => void;
  onEdit?: (template: Template) => void;
  onSelect?: (template: Template) => void;
  selectionMode?: boolean;
}

const TemplatesList: React.FC<TemplatesListProps> = ({
  onCreateNew,
  onEdit,
  onSelect,
  selectionMode = false,
}) => {
  const dispatch = useAppDispatch();
  const templates = useAppSelector(selectTemplates);
  const loading = useAppSelector(selectTemplatesLoading);
  const filters = useAppSelector(selectTemplatesFilters);

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Load templates on mount
  useEffect(() => {
    dispatch(fetchTemplates(filters));
  }, [dispatch, filters]);

  // Handle search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery !== filters.search) {
        dispatch(setFilters({ search: searchQuery || undefined }));
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, dispatch, filters.search]);

  const handleCategoryFilter = useCallback((category: TemplateCategory | undefined) => {
    dispatch(setFilters({ category }));
  }, [dispatch]);

  const handleStatusFilter = useCallback((status: TemplateStatus | undefined) => {
    dispatch(setFilters({ status }));
  }, [dispatch]);

  const handleClearFilters = useCallback(() => {
    setSearchQuery('');
    dispatch(clearFilters());
  }, [dispatch]);

  const handleDelete = useCallback(async (id: string) => {
    await dispatch(deleteTemplate(id));
    setDeleteConfirm(null);
  }, [dispatch]);

  const handleDuplicate = useCallback(async (id: string) => {
    await dispatch(duplicateTemplate({ id }));
  }, [dispatch]);

  const getCategoryLabel = (category: TemplateCategory): string => {
    const catInfo = TEMPLATE_CATEGORIES[category];
    return catInfo?.label || category;
  };

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

  const getStatusBadge = (status: TemplateStatus): string => {
    const badges: Record<TemplateStatus, string> = {
      draft: 'bg-gray-100 text-gray-600',
      active: 'bg-green-100 text-green-700',
      archived: 'bg-red-100 text-red-600',
    };
    return badges[status] || badges.draft;
  };

  const renderTemplateCard = (template: Template) => (
    <div
      key={template.id}
      className={`
        bg-white rounded-lg border border-gray-200 overflow-hidden
        hover:shadow-lg transition-shadow duration-200
        ${selectionMode ? 'cursor-pointer hover:border-blue-500' : ''}
      `}
      onClick={() => selectionMode && onSelect?.(template)}
    >
      {/* Preview */}
      <div className="h-40 bg-gray-50 relative overflow-hidden">
        {template.thumbnail ? (
          <img
            src={template.thumbnail}
            alt={template.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-2 rounded bg-gray-200" />
              <span className="text-sm">No preview</span>
            </div>
          </div>
        )}
        {template.isBuiltIn && (
          <span className="absolute top-2 left-2 px-2 py-1 bg-blue-600 text-white text-xs rounded">
            Built-in
          </span>
        )}
        <span className={`absolute top-2 right-2 px-2 py-1 text-xs rounded ${getStatusBadge(template.status)}`}>
          {template.status}
        </span>
      </div>

      {/* Info */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-medium text-gray-900 truncate flex-1">{template.name}</h3>
        </div>
        
        {template.description && (
          <p className="text-sm text-gray-500 line-clamp-2 mb-3">{template.description}</p>
        )}

        <div className="flex items-center gap-2 mb-3">
          <span className={`px-2 py-1 text-xs rounded ${getCategoryColor(template.category)}`}>
            {getCategoryLabel(template.category)}
          </span>
          {template.detectedFields && template.detectedFields.length > 0 && (
            <span className="text-xs text-gray-500">
              {template.detectedFields.length} fields
            </span>
          )}
        </div>

        {/* Tags */}
        {template.tags && template.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {template.tags.slice(0, 3).map((tag, i) => (
              <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                {tag}
              </span>
            ))}
            {template.tags.length > 3 && (
              <span className="text-xs text-gray-400">+{template.tags.length - 3}</span>
            )}
          </div>
        )}

        {/* Actions */}
        {!selectionMode && (
          <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit?.(template);
              }}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded transition-colors"
            >
              <EditIcon />
              Edit
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDuplicate(template.id);
              }}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded transition-colors"
            >
              <DuplicateIcon />
              Copy
            </button>
            {!template.isBuiltIn && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteConfirm(template.id);
                }}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded transition-colors ml-auto"
              >
                <TrashIcon />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      {deleteConfirm === template.id && (
        <div className="p-4 bg-red-50 border-t border-red-100">
          <p className="text-sm text-red-800 mb-2">Delete this template?</p>
          <div className="flex gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(template.id);
              }}
              className="px-3 py-1.5 bg-red-600 text-white text-sm rounded hover:bg-red-700"
            >
              Delete
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setDeleteConfirm(null);
              }}
              className="px-3 py-1.5 bg-white text-gray-700 text-sm rounded border hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const renderTemplateRow = (template: Template) => (
    <tr
      key={template.id}
      className={`
        hover:bg-gray-50
        ${selectionMode ? 'cursor-pointer' : ''}
      `}
      onClick={() => selectionMode && onSelect?.(template)}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-16 h-10 bg-gray-100 rounded overflow-hidden flex-shrink-0">
            {template.thumbnail ? (
              <img src={template.thumbnail} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                N/A
              </div>
            )}
          </div>
          <div>
            <div className="font-medium text-gray-900">{template.name}</div>
            {template.description && (
              <div className="text-sm text-gray-500 truncate max-w-xs">{template.description}</div>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className={`px-2 py-1 text-xs rounded ${getCategoryColor(template.category)}`}>
          {getCategoryLabel(template.category)}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className={`px-2 py-1 text-xs rounded ${getStatusBadge(template.status)}`}>
          {template.status}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-gray-500">
        {template.detectedFields?.length || 0} fields
      </td>
      <td className="px-4 py-3">
        {template.isBuiltIn && (
          <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">Built-in</span>
        )}
      </td>
      <td className="px-4 py-3">
        {!selectionMode && (
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit?.(template);
              }}
              className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
              title="Edit"
            >
              <EditIcon />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDuplicate(template.id);
              }}
              className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded"
              title="Duplicate"
            >
              <DuplicateIcon />
            </button>
            {!template.isBuiltIn && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteConfirm(template.id);
                }}
                className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                title="Delete"
              >
                <TrashIcon />
              </button>
            )}
          </div>
        )}
      </td>
    </tr>
  );

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Templates</h2>
          {onCreateNew && (
            <Button onClick={onCreateNew} className="flex items-center gap-2">
              <PlusIcon />
              New Template
            </Button>
          )}
        </div>

        {/* Search and Filters */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <SearchIcon />
            <input
              type="text"
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`
              flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors
              ${showFilters ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}
            `}
          >
            <FilterIcon />
            Filters
          </button>

          <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 ${viewMode === 'grid' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              <GridIcon />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 ${viewMode === 'list' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              <ListIcon />
            </button>
          </div>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={filters.category || ''}
                  onChange={(e) => handleCategoryFilter(e.target.value as TemplateCategory || undefined)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Categories</option>
                  {(Object.keys(TEMPLATE_CATEGORIES) as TemplateCategory[]).map((catKey) => (
                    <option key={catKey} value={catKey}>{TEMPLATE_CATEGORIES[catKey].label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={filters.status || ''}
                  onChange={(e) => handleStatusFilter(e.target.value as TemplateStatus || undefined)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Statuses</option>
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              <div className="flex items-end">
                <button
                  onClick={handleClearFilters}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <div className="w-16 h-16 mb-4 rounded-full bg-gray-100 flex items-center justify-center">
              <GridIcon />
            </div>
            <p className="text-lg font-medium mb-2">No templates found</p>
            <p className="text-sm mb-4">Create your first template to get started</p>
            {onCreateNew && (
              <Button onClick={onCreateNew} className="flex items-center gap-2">
                <PlusIcon />
                Create Template
              </Button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {templates.map(renderTemplateCard)}
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Template</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Category</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Fields</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Type</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {templates.map(renderTemplateRow)}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default TemplatesList;
