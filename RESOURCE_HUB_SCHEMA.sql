-- ========================================
-- RESOURCE HUB DATABASE SCHEMA
-- ========================================
-- This file contains the complete schema for the Resource Hub feature
-- Run this in Supabase SQL Editor to create all necessary tables and policies
--
-- PREREQUISITES:
-- 1. The following helper functions must exist (they should already be in your database):
--    - update_updated_at_column()
--    - get_user_role(user_id uuid)
-- 2. The master_tasks table must exist
-- 3. The auth.users table must exist (Supabase default)
--
-- WHAT THIS CREATES:
-- 1. policy_documents table - stores all policy documents and task instructions
-- 2. task_document_links table - links documents to master tasks (many-to-many)
-- 3. Indexes for performance
-- 4. Triggers for automatic updated_at timestamps
-- 5. Row Level Security (RLS) policies for public viewing and admin management
-- ========================================

-- ========================================
-- STEP 1: CREATE POLICY DOCUMENTS TABLE
-- ========================================

CREATE TABLE IF NOT EXISTS policy_documents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    document_url TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN (
        'hr',
        'stock-control',
        'policies',
        'compliance',
        'cleaning',
        'pharmacy-services',
        'fos-operations',
        'dispensary-operations',
        'general-pharmacy-operations',
        'business-management',
        'general'
    )),
    document_type TEXT NOT NULL CHECK (document_type IN ('general-policy', 'task-instruction')),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE policy_documents IS 'Stores all policy documents and task instructions for the Resource Hub';
COMMENT ON COLUMN policy_documents.title IS 'Display title of the document';
COMMENT ON COLUMN policy_documents.document_url IS 'URL to the document (typically Google Docs link)';
COMMENT ON COLUMN policy_documents.category IS 'Category for organizing documents';
COMMENT ON COLUMN policy_documents.document_type IS 'Type: general-policy or task-instruction';
COMMENT ON COLUMN policy_documents.description IS 'Optional description of the document';

-- ========================================
-- STEP 2: CREATE TASK DOCUMENT LINKS TABLE
-- ========================================

CREATE TABLE IF NOT EXISTS task_document_links (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    master_task_id UUID REFERENCES master_tasks(id) ON DELETE CASCADE,
    policy_document_id UUID REFERENCES policy_documents(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (master_task_id, policy_document_id)
);

COMMENT ON TABLE task_document_links IS 'Many-to-many relationship between master tasks and policy documents';
COMMENT ON COLUMN task_document_links.master_task_id IS 'Reference to master_tasks table';
COMMENT ON COLUMN task_document_links.policy_document_id IS 'Reference to policy_documents table';

-- ========================================
-- STEP 3: CREATE INDEXES FOR PERFORMANCE
-- ========================================

CREATE INDEX IF NOT EXISTS idx_policy_documents_category 
    ON policy_documents(category);

CREATE INDEX IF NOT EXISTS idx_policy_documents_document_type 
    ON policy_documents(document_type);

CREATE INDEX IF NOT EXISTS idx_task_document_links_master_task_id 
    ON task_document_links(master_task_id);

CREATE INDEX IF NOT EXISTS idx_task_document_links_policy_document_id 
    ON task_document_links(policy_document_id);

-- ========================================
-- STEP 4: CREATE TRIGGERS FOR UPDATED_AT
-- ========================================

-- Trigger to automatically update updated_at timestamp on policy_documents
DROP TRIGGER IF EXISTS update_policy_documents_updated_at ON policy_documents;
CREATE TRIGGER update_policy_documents_updated_at 
    BEFORE UPDATE ON policy_documents 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- STEP 5: ENABLE ROW LEVEL SECURITY (RLS)
-- ========================================

ALTER TABLE policy_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_document_links ENABLE ROW LEVEL SECURITY;

-- ========================================
-- STEP 6: CREATE RLS POLICIES FOR POLICY_DOCUMENTS
-- ========================================

-- Policy 1: Anyone can view policy documents (no authentication required)
-- This allows public access to the Resource Hub page
DROP POLICY IF EXISTS "Anyone can view policy documents" ON policy_documents;
CREATE POLICY "Anyone can view policy documents" ON policy_documents
    FOR SELECT
    USING (true);

-- Policy 2: Only admins can insert, update, or delete policy documents
-- This protects the admin management interface
DROP POLICY IF EXISTS "Admins can manage policy documents" ON policy_documents;
CREATE POLICY "Admins can manage policy documents" ON policy_documents
    FOR ALL TO authenticated
    USING (get_user_role(auth.uid()) = 'admin')
    WITH CHECK (get_user_role(auth.uid()) = 'admin');

-- ========================================
-- STEP 7: CREATE RLS POLICIES FOR TASK_DOCUMENT_LINKS
-- ========================================

-- Policy 1: Anyone can view task document links (no authentication required)
-- This allows public access to see which documents are linked to tasks
DROP POLICY IF EXISTS "Anyone can view task document links" ON task_document_links;
CREATE POLICY "Anyone can view task document links" ON task_document_links
    FOR SELECT
    USING (true);

-- Policy 2: Only admins can insert, update, or delete task document links
-- This protects the admin linking interface in Master Task Management
DROP POLICY IF EXISTS "Admins can manage task document links" ON task_document_links;
CREATE POLICY "Admins can manage task document links" ON task_document_links
    FOR ALL TO authenticated
    USING (get_user_role(auth.uid()) = 'admin')
    WITH CHECK (get_user_role(auth.uid()) = 'admin');

-- ========================================
-- STEP 8: VERIFY INSTALLATION
-- ========================================

-- Run these queries to verify the tables were created successfully:

-- Check policy_documents table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'policy_documents'
ORDER BY ordinal_position;

-- Check task_document_links table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'task_document_links'
ORDER BY ordinal_position;

-- Check indexes
SELECT 
    indexname, 
    indexdef
FROM pg_indexes
WHERE tablename IN ('policy_documents', 'task_document_links')
ORDER BY tablename, indexname;

-- Check RLS policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename IN ('policy_documents', 'task_document_links')
ORDER BY tablename, policyname;

-- ========================================
-- OPTIONAL: SAMPLE DATA FOR TESTING
-- ========================================

-- Uncomment the following to insert sample data for testing:

/*
-- Insert a sample policy document
INSERT INTO policy_documents (title, document_url, category, document_type, description)
VALUES (
    'Sample Policy Document',
    'https://docs.google.com/document/d/sample-id/edit',
    'general',
    'general-policy',
    'This is a sample policy document for testing'
);

-- Insert a sample task instruction
INSERT INTO policy_documents (title, document_url, category, document_type, description)
VALUES (
    'Sample Task Instruction',
    'https://docs.google.com/document/d/sample-id-2/edit',
    'compliance',
    'task-instruction',
    'This is a sample task instruction for testing'
);

-- Link a document to a master task (replace with actual master_task_id)
-- First, get a master task ID:
-- SELECT id, title FROM master_tasks LIMIT 1;

-- Then insert the link:
-- INSERT INTO task_document_links (master_task_id, policy_document_id)
-- VALUES (
--     'your-master-task-id-here',
--     (SELECT id FROM policy_documents WHERE title = 'Sample Task Instruction')
-- );
*/

-- ========================================
-- COMPLETION MESSAGE
-- ========================================

DO $$
BEGIN
    RAISE NOTICE '✅ Resource Hub schema installation complete!';
    RAISE NOTICE '';
    RAISE NOTICE '📋 Created tables:';
    RAISE NOTICE '   - policy_documents';
    RAISE NOTICE '   - task_document_links';
    RAISE NOTICE '';
    RAISE NOTICE '🔒 RLS policies enabled:';
    RAISE NOTICE '   - Public can view all documents and links';
    RAISE NOTICE '   - Only admins can manage documents and links';
    RAISE NOTICE '';
    RAISE NOTICE '🚀 Next steps:';
    RAISE NOTICE '   1. Verify tables in Supabase Table Editor';
    RAISE NOTICE '   2. Test API endpoints at /api/resource-hub';
    RAISE NOTICE '   3. Access Resource Hub at /resource-hub';
    RAISE NOTICE '   4. Manage documents in Admin Dashboard';
END $$;