-- Resource Hub Implementation
-- Creates tables for policy documents and links them to master tasks

-- ========================================
-- POLICY DOCUMENTS TABLE
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

-- ========================================
-- TASK DOCUMENT LINKS TABLE
-- ========================================

CREATE TABLE IF NOT EXISTS task_document_links (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    master_task_id UUID REFERENCES master_tasks(id) ON DELETE CASCADE,
    policy_document_id UUID REFERENCES policy_documents(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (master_task_id, policy_document_id)
);

-- ========================================
-- INDEXES
-- ========================================

CREATE INDEX IF NOT EXISTS idx_policy_documents_category ON policy_documents(category);
CREATE INDEX IF NOT EXISTS idx_policy_documents_document_type ON policy_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_task_document_links_master_task_id ON task_document_links(master_task_id);
CREATE INDEX IF NOT EXISTS idx_task_document_links_policy_document_id ON task_document_links(policy_document_id);

-- ========================================
-- TRIGGERS
-- ========================================

DROP TRIGGER IF EXISTS update_policy_documents_updated_at ON policy_documents;
CREATE TRIGGER update_policy_documents_updated_at 
    BEFORE UPDATE ON policy_documents 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- ROW LEVEL SECURITY (RLS)
-- ========================================

ALTER TABLE policy_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_document_links ENABLE ROW LEVEL SECURITY;

-- Public can view all policy documents (no authentication required)
DROP POLICY IF EXISTS "Anyone can view policy documents" ON policy_documents;
CREATE POLICY "Anyone can view policy documents" ON policy_documents
  FOR SELECT
  USING (true);

-- Admins can manage policy documents
DROP POLICY IF EXISTS "Admins can manage policy documents" ON policy_documents;
CREATE POLICY "Admins can manage policy documents" ON policy_documents
  FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) = 'admin')
  WITH CHECK (get_user_role(auth.uid()) = 'admin');

-- Public can view task document links
DROP POLICY IF EXISTS "Anyone can view task document links" ON task_document_links;
CREATE POLICY "Anyone can view task document links" ON task_document_links
  FOR SELECT
  USING (true);

-- Admins can manage task document links
DROP POLICY IF EXISTS "Admins can manage task document links" ON task_document_links;
CREATE POLICY "Admins can manage task document links" ON task_document_links
  FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) = 'admin')
  WITH CHECK (get_user_role(auth.uid()) = 'admin');

-- ========================================
-- AUDIT LOG ACTIONS
-- ========================================

-- Add new audit log actions for resource hub
-- Note: This requires modifying the audit_log table constraint
-- Run this separately if the constraint needs to be updated

-- ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_action_check;
-- ALTER TABLE audit_log ADD CONSTRAINT audit_log_action_check CHECK (action IN (
--     'created', 'completed', 'uncompleted', 'status_changed', 
--     'locked', 'unlocked', 'acknowledged', 'resolved',
--     'updated', 'deleted',
--     'holiday_created', 'holiday_updated', 'holiday_deleted', 'holiday_sync',
--     'user_login', 'user_logout', 'user_created', 'user_updated', 'user_deleted',
--     'position_created', 'position_updated', 'position_deleted',
--     'system_config_changed', 'backup_created', 'maintenance_mode_toggled',
--     'viewed', 'exported', 'imported', 'bulk_operation',
--     'document_created', 'document_updated', 'document_deleted', 'document_linked', 'document_unlinked'
-- ));