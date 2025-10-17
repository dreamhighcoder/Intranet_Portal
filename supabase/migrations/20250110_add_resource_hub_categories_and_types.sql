-- Add Resource Hub categories and types to system_settings
-- These settings store the available categories and document types for the Resource Hub

INSERT INTO system_settings (key, value, description, data_type, is_public) 
VALUES 
  ('resource_hub_categories', '[{"id":"hr","label":"HR","emoji":"👥","color":"bg-purple-100 text-purple-800 border-purple-200"},{"id":"stock-control","label":"Stock Control","emoji":"📦","color":"bg-blue-100 text-blue-800 border-blue-200"},{"id":"policies","label":"Policies","emoji":"📋","color":"bg-gray-100 text-gray-800 border-gray-200"}]', 'Resource Hub document categories', 'json', false),
  ('resource_hub_document_types', '[{"id":"general-policy","label":"General Policy","color":"bg-blue-50 text-blue-700 border-blue-200"},{"id":"task-instruction","label":"Task Instruction","color":"bg-green-50 text-green-700 border-green-200"}]', 'Resource Hub document types', 'json', false)
ON CONFLICT (key) DO NOTHING;