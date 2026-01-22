/**
 * TemplateEditor Component
 * 
 * Visual editor for creating and editing templates.
 * Supports HTML/CSS editing with live preview and field detection.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import {
  createTemplate,
  updateTemplate,
  detectFieldsFromHtml,
  setCurrentTemplate,
  selectTemplatesSaving,
  selectTemplatesDetecting,
} from '../templatesSlice';
import {
  Template,
  TemplateCategory,
  DetectedField,
  TEMPLATE_CATEGORIES,
  CreateTemplateRequest,
  UpdateTemplateRequest,
} from '../../../shared/types/template';
import { Button } from '../../../shared/components/Button';
import TemplatePreview from './TemplatePreview';
import TemplateFieldsDetector from './TemplateFieldsDetector';

// Icons
const SaveIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
  </svg>
);

const CodeIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
  </svg>
);

const EyeIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);

const FieldsIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
  </svg>
);

const SettingsIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const DetectIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
  </svg>
);

const CloseIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

type EditorTab = 'html' | 'css' | 'preview' | 'fields' | 'settings';

interface TemplateEditorProps {
  template?: Template | null;
  onClose?: () => void;
  onSave?: (template: Template) => void;
}

const TemplateEditor: React.FC<TemplateEditorProps> = ({
  template,
  onClose,
  onSave,
}) => {
  const dispatch = useAppDispatch();
  const saving = useAppSelector(selectTemplatesSaving);
  const detecting = useAppSelector(selectTemplatesDetecting);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<TemplateCategory>('card');
  const [htmlContent, setHtmlContent] = useState('');
  const [cssContent, setCssContent] = useState('');
  const [detectedFields, setDetectedFields] = useState<DetectedField[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  // UI state
  const [activeTab, setActiveTab] = useState<EditorTab>('html');
  const [hasChanges, setHasChanges] = useState(false);
  const [previewData, setPreviewData] = useState<Record<string, unknown>>({});

  const htmlRef = useRef<HTMLTextAreaElement>(null);
  const cssRef = useRef<HTMLTextAreaElement>(null);

  // Initialize form when template changes
  useEffect(() => {
    if (template) {
      setName(template.name);
      setDescription(template.description || '');
      setCategory(template.category);
      setHtmlContent(template.htmlContent || '');
      setCssContent(template.cssContent || '');
      setDetectedFields(template.detectedFields || []);
      setTags(template.tags || []);
      setPreviewData(template.previewData as Record<string, unknown> || {});
      dispatch(setCurrentTemplate(template));
    } else {
      // New template defaults
      setName('');
      setDescription('');
      setCategory('card');
      setHtmlContent(getDefaultHtml('card'));
      setCssContent(getDefaultCss('card'));
      setDetectedFields([]);
      setTags([]);
      setPreviewData({});
    }
    setHasChanges(false);
  }, [template, dispatch]);

  // Track changes
  useEffect(() => {
    if (template) {
      const changed =
        name !== template.name ||
        description !== (template.description || '') ||
        category !== template.category ||
        htmlContent !== (template.htmlContent || '') ||
        cssContent !== (template.cssContent || '') ||
        JSON.stringify(detectedFields) !== JSON.stringify(template.detectedFields || []) ||
        JSON.stringify(tags) !== JSON.stringify(template.tags || []);
      setHasChanges(changed);
    } else {
      setHasChanges(name.length > 0 || htmlContent.length > 0);
    }
  }, [name, description, category, htmlContent, cssContent, detectedFields, tags, template]);

  const getDefaultHtml = (cat: TemplateCategory): string => {
    const templates: Record<TemplateCategory, string> = {
      card: `<div class="template-card">
  <img data-bind="image" src="https://via.placeholder.com/300x200" alt="" class="card-image" />
  <div class="card-content">
    <h3 data-bind="title">Card Title</h3>
    <p data-bind="description">Card description text goes here.</p>
    <a data-bind="link" href="#" class="card-link">Learn More</a>
  </div>
</div>`,
      'list-item': `<li class="list-item">
  <span data-bind="icon" class="item-icon">•</span>
  <span data-bind="text">List item text</span>
</li>`,
      'table-row': `<tr class="table-row">
  <td data-bind="col1">Column 1</td>
  <td data-bind="col2">Column 2</td>
  <td data-bind="col3">Column 3</td>
</tr>`,
      gallery: `<div class="gallery-item">
  <img data-bind="image" src="https://via.placeholder.com/400x300" alt="" />
  <div class="gallery-caption" data-bind="caption">Image caption</div>
</div>`,
      testimonial: `<div class="testimonial">
  <div class="testimonial-quote" data-bind="quote">"Great product!"</div>
  <div class="testimonial-author">
    <img data-bind="avatar" src="https://via.placeholder.com/50" class="author-avatar" />
    <span data-bind="name">John Doe</span>
    <span data-bind="title">CEO, Company</span>
  </div>
</div>`,
      'team-member': `<div class="team-member">
  <img data-bind="photo" src="https://via.placeholder.com/200" class="member-photo" />
  <h4 data-bind="name">Team Member</h4>
  <p data-bind="role">Position</p>
  <p data-bind="bio">Short bio text</p>
</div>`,
      pricing: `<div class="pricing-card">
  <h3 data-bind="planName">Plan Name</h3>
  <div class="price">
    <span data-bind="currency">$</span>
    <span data-bind="amount">99</span>
    <span data-bind="period">/mo</span>
  </div>
  <ul data-bind="features" class="features-list"></ul>
  <a data-bind="ctaLink" href="#" class="cta-button">Get Started</a>
</div>`,
      feature: `<div class="feature">
  <div data-bind="icon" class="feature-icon">⭐</div>
  <h4 data-bind="title">Feature Title</h4>
  <p data-bind="description">Feature description</p>
</div>`,
      faq: `<div class="faq-item">
  <h4 data-bind="question" class="faq-question">Question?</h4>
  <div data-bind="answer" class="faq-answer">Answer text here.</div>
</div>`,
      'blog-post': `<article class="blog-post">
  <img data-bind="thumbnail" src="https://via.placeholder.com/600x300" class="post-thumbnail" />
  <div class="post-meta">
    <span data-bind="date">Jan 1, 2024</span>
    <span data-bind="category">Category</span>
  </div>
  <h2 data-bind="title">Blog Post Title</h2>
  <p data-bind="excerpt">Post excerpt...</p>
  <a data-bind="link" href="#">Read More</a>
</article>`,
      custom: `<div class="custom-template">
  <!-- Add your HTML here -->
  <div data-bind="content">Content</div>
</div>`,
    };
    return templates[cat] || templates.custom;
  };

  const getDefaultCss = (cat: TemplateCategory): string => {
    const styles: Record<TemplateCategory, string> = {
      card: `.template-card {
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}
.card-image {
  width: 100%;
  height: 200px;
  object-fit: cover;
}
.card-content {
  padding: 16px;
}
.card-content h3 {
  margin: 0 0 8px 0;
  font-size: 18px;
}
.card-content p {
  margin: 0 0 12px 0;
  color: #666;
}
.card-link {
  color: #007bff;
  text-decoration: none;
}`,
      'list-item': `.list-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
}`,
      'table-row': `.table-row td {
  padding: 12px;
  border-bottom: 1px solid #eee;
}`,
      gallery: `.gallery-item {
  position: relative;
}
.gallery-item img {
  width: 100%;
  display: block;
}
.gallery-caption {
  padding: 8px;
  text-align: center;
}`,
      testimonial: `.testimonial {
  padding: 24px;
  text-align: center;
}
.testimonial-quote {
  font-size: 18px;
  font-style: italic;
  margin-bottom: 16px;
}
.author-avatar {
  width: 50px;
  height: 50px;
  border-radius: 50%;
}`,
      'team-member': `.team-member {
  text-align: center;
  padding: 16px;
}
.member-photo {
  width: 150px;
  height: 150px;
  border-radius: 50%;
  object-fit: cover;
}`,
      pricing: `.pricing-card {
  padding: 24px;
  text-align: center;
  border: 1px solid #ddd;
  border-radius: 8px;
}
.price {
  font-size: 36px;
  margin: 16px 0;
}
.cta-button {
  display: inline-block;
  padding: 12px 24px;
  background: #007bff;
  color: white;
  border-radius: 4px;
  text-decoration: none;
}`,
      feature: `.feature {
  text-align: center;
  padding: 16px;
}
.feature-icon {
  font-size: 32px;
  margin-bottom: 12px;
}`,
      faq: `.faq-item {
  padding: 16px 0;
  border-bottom: 1px solid #eee;
}
.faq-question {
  cursor: pointer;
  margin: 0;
}
.faq-answer {
  margin-top: 8px;
  color: #666;
}`,
      'blog-post': `.blog-post {
  max-width: 600px;
}
.post-thumbnail {
  width: 100%;
}
.post-meta {
  padding: 8px 0;
  font-size: 14px;
  color: #888;
}`,
      custom: `.custom-template {
  padding: 16px;
}`,
    };
    return styles[cat] || styles.custom;
  };

  const handleDetectFields = useCallback(async () => {
    if (!htmlContent.trim()) return;
    
    const result = await dispatch(detectFieldsFromHtml(htmlContent));
    if (detectFieldsFromHtml.fulfilled.match(result)) {
      setDetectedFields(result.payload.detectedFields);
    }
  }, [dispatch, htmlContent]);

  const handleFieldsChange = useCallback((fields: DetectedField[]) => {
    setDetectedFields(fields);
  }, []);

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      alert('Please enter a template name');
      return;
    }

    const templateData = {
      name: name.trim(),
      description: description.trim() || undefined,
      category,
      htmlContent,
      cssContent,
      detectedFields,
      tags,
      previewData,
    };

    try {
      let result;
      if (template?.id) {
        result = await dispatch(updateTemplate({
          id: template.id,
          data: templateData as UpdateTemplateRequest,
        }));
      } else {
        result = await dispatch(createTemplate(templateData as CreateTemplateRequest));
      }

      if (createTemplate.fulfilled.match(result) || updateTemplate.fulfilled.match(result)) {
        onSave?.(result.payload);
        setHasChanges(false);
      }
    } catch (error) {
      console.error('Failed to save template:', error);
    }
  }, [
    dispatch, template, name, description, category,
    htmlContent, cssContent, detectedFields, tags, previewData, onSave
  ]);

  const handleAddTag = useCallback(() => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
      setTagInput('');
    }
  }, [tagInput, tags]);

  const handleRemoveTag = useCallback((tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  }, [tags]);

  const handleCategoryChange = useCallback((newCategory: TemplateCategory) => {
    setCategory(newCategory);
    // Optionally load default templates for new templates
    if (!template) {
      setHtmlContent(getDefaultHtml(newCategory));
      setCssContent(getDefaultCss(newCategory));
    }
  }, [template]);

  const tabs: { id: EditorTab; label: string; icon: JSX.Element }[] = [
    { id: 'html', label: 'HTML', icon: <CodeIcon /> },
    { id: 'css', label: 'CSS', icon: <CodeIcon /> },
    { id: 'preview', label: 'Preview', icon: <EyeIcon /> },
    { id: 'fields', label: 'Fields', icon: <FieldsIcon /> },
    { id: 'settings', label: 'Settings', icon: <SettingsIcon /> },
  ];

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Template name..."
              className="text-lg font-semibold bg-transparent border-none focus:outline-none focus:ring-0"
            />
            {hasChanges && (
              <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded">
                Unsaved changes
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleDetectFields}
              variant="secondary"
              disabled={detecting || !htmlContent.trim()}
              className="flex items-center gap-2"
            >
              <DetectIcon />
              {detecting ? 'Detecting...' : 'Detect Fields'}
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !name.trim()}
              className="flex items-center gap-2"
            >
              <SaveIcon />
              {saving ? 'Saving...' : 'Save'}
            </Button>
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
              >
                <CloseIcon />
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mt-3">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-t text-sm font-medium transition-colors
                ${activeTab === tab.id
                  ? 'bg-gray-100 text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}
              `}
            >
              {tab.icon}
              {tab.label}
              {tab.id === 'fields' && detectedFields.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full">
                  {detectedFields.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'html' && (
          <div className="h-full p-4">
            <textarea
              ref={htmlRef}
              value={htmlContent}
              onChange={(e) => setHtmlContent(e.target.value)}
              placeholder="Enter HTML template..."
              className="w-full h-full p-4 font-mono text-sm bg-gray-900 text-gray-100 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              spellCheck={false}
            />
          </div>
        )}

        {activeTab === 'css' && (
          <div className="h-full p-4">
            <textarea
              ref={cssRef}
              value={cssContent}
              onChange={(e) => setCssContent(e.target.value)}
              placeholder="Enter CSS styles..."
              className="w-full h-full p-4 font-mono text-sm bg-gray-900 text-gray-100 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              spellCheck={false}
            />
          </div>
        )}

        {activeTab === 'preview' && (
          <div className="h-full p-4 overflow-auto">
            <TemplatePreview
              htmlContent={htmlContent}
              cssContent={cssContent}
              fields={detectedFields}
              data={previewData}
              onDataChange={setPreviewData}
            />
          </div>
        )}

        {activeTab === 'fields' && (
          <div className="h-full p-4 overflow-auto">
            <TemplateFieldsDetector
              fields={detectedFields}
              onChange={handleFieldsChange}
              htmlContent={htmlContent}
              onDetect={handleDetectFields}
              detecting={detecting}
            />
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="h-full p-4 overflow-auto">
            <div className="max-w-2xl space-y-6">
              {/* Basic Info */}
              <div className="bg-white rounded-lg p-6 shadow-sm">
                <h3 className="text-lg font-medium mb-4">Basic Information</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Brief description of this template..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Category
                    </label>
                    <select
                      value={category}
                      onChange={(e) => handleCategoryChange(e.target.value as TemplateCategory)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      {(Object.keys(TEMPLATE_CATEGORIES) as TemplateCategory[]).map((catKey) => (
                        <option key={catKey} value={catKey}>
                          {TEMPLATE_CATEGORIES[catKey].label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tags
                    </label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded"
                        >
                          {tag}
                          <button
                            onClick={() => handleRemoveTag(tag)}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                        placeholder="Add tag..."
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                      <Button onClick={handleAddTag} variant="secondary">
                        Add
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Template Info */}
              {template && (
                <div className="bg-white rounded-lg p-6 shadow-sm">
                  <h3 className="text-lg font-medium mb-4">Template Info</h3>
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-gray-500">ID</dt>
                      <dd className="font-mono text-gray-900">{template.id}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Created</dt>
                      <dd className="text-gray-900">
                        {new Date(template.createdAt).toLocaleString()}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Updated</dt>
                      <dd className="text-gray-900">
                        {new Date(template.updatedAt).toLocaleString()}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Status</dt>
                      <dd className="text-gray-900">{template.status}</dd>
                    </div>
                    {template.isBuiltIn && (
                      <div className="flex justify-between">
                        <dt className="text-gray-500">Type</dt>
                        <dd className="text-blue-600">Built-in Template</dd>
                      </div>
                    )}
                  </dl>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TemplateEditor;
