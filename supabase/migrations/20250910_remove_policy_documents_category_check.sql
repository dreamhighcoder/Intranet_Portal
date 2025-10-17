-- Remove hardcoded CHECK constraints from policy_documents
-- These constraints were limiting categories and document types to predefined lists,
-- but now both are dynamically managed in system_settings via ResourceHubConfigManager

-- Drop the old category constraint
ALTER TABLE policy_documents 
DROP CONSTRAINT IF EXISTS policy_documents_category_check;

-- Drop the old document_type constraint  
ALTER TABLE policy_documents 
DROP CONSTRAINT IF EXISTS policy_documents_document_type_check;

-- Optional: Add comments explaining the changes
COMMENT ON COLUMN policy_documents.category IS 'Category ID - references resource_hub_categories in system_settings. No CHECK constraint to allow dynamic category management.';
COMMENT ON COLUMN policy_documents.document_type IS 'Document type ID - references document_types in system_settings. No CHECK constraint to allow dynamic type management.';