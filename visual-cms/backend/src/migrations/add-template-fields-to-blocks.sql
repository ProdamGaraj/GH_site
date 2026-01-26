-- Add template functionality to blocks table
-- Migration: add-template-fields-to-blocks

ALTER TABLE blocks 
ADD COLUMN is_template BOOLEAN DEFAULT false,
ADD COLUMN template_category VARCHAR(50),
ADD COLUMN detected_fields JSONB,
ADD COLUMN template_settings JSONB;

-- Create indexes for better performance
CREATE INDEX idx_blocks_is_template ON blocks(is_template) WHERE is_template = true;
CREATE INDEX idx_blocks_template_category ON blocks(template_category) WHERE template_category IS NOT NULL;

-- Add comment
COMMENT ON COLUMN blocks.is_template IS 'Whether this block functions as a template for data binding';
COMMENT ON COLUMN blocks.detected_fields IS 'Auto-detected bindable fields from block structure';
COMMENT ON COLUMN blocks.template_settings IS 'Template-specific settings (animation, responsive, etc)';
