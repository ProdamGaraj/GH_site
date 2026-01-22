/**
 * TemplatesPage
 * 
 * Full-page view for managing templates.
 * Combines list and editor in a split view.
 */

import React, { useState, useCallback } from 'react';
import { TemplatesList, TemplateEditor } from '../features/templates';
import { Template } from '../shared/types/template';

const TemplatesPage: React.FC = () => {
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateNew = useCallback(() => {
    setEditingTemplate(null);
    setIsCreating(true);
  }, []);

  const handleEdit = useCallback((template: Template) => {
    setEditingTemplate(template);
    setIsCreating(true);
  }, []);

  const handleClose = useCallback(() => {
    setEditingTemplate(null);
    setIsCreating(false);
  }, []);

  const handleSave = useCallback((template: Template) => {
    // Update the editing template to show the saved version
    setEditingTemplate(template);
    // Could optionally close the editor:
    // handleClose();
  }, []);

  return (
    <div className="h-screen flex bg-gray-100">
      {/* Left Panel - List */}
      <div className={`${isCreating ? 'w-1/3' : 'w-full'} border-r border-gray-200 bg-white transition-all duration-300`}>
        <TemplatesList
          onCreateNew={handleCreateNew}
          onEdit={handleEdit}
        />
      </div>

      {/* Right Panel - Editor */}
      {isCreating && (
        <div className="flex-1 bg-white">
          <TemplateEditor
            template={editingTemplate}
            onClose={handleClose}
            onSave={handleSave}
          />
        </div>
      )}
    </div>
  );
};

export default TemplatesPage;
