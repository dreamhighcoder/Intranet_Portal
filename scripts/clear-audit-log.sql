-- Clear Audit Log Table
-- This script will empty the audit_log table completely
-- Run this in Supabase SQL Editor or via psql

-- Check current record count
SELECT 'Current audit_log records:' as info, COUNT(*) as count FROM audit_log;

-- Delete all records from audit_log table
DELETE FROM audit_log;

-- Verify the table is now empty
SELECT 'Remaining audit_log records:' as info, COUNT(*) as count FROM audit_log;

-- Optional: Reset the sequence if you want IDs to start from 1 again
-- Note: This is not necessary since we're using UUIDs, but included for completeness
-- ALTER SEQUENCE IF EXISTS audit_log_id_seq RESTART WITH 1;

SELECT 'Audit log table has been cleared successfully!' as result;