-- Verification Script for Pharmacy Portal Database Setup
-- Run this after schema.sql and seed-data.sql to verify everything is working

-- ========================================
-- TABLE VERIFICATION
-- ========================================

DO $$
DECLARE
    table_count INTEGER;
    expected_tables TEXT[] := ARRAY[
        'positions', 'user_profiles', 'master_tasks', 'task_instances',
        'public_holidays', 'audit_log', 'system_settings', 
        'task_completion_log', 'notification_settings'
    ];
    missing_tables TEXT := '';
    table_name TEXT;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'VERIFYING DATABASE SETUP';
    RAISE NOTICE '========================================';
    
    -- Check if all tables exist
    SELECT COUNT(*) INTO table_count 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = ANY(expected_tables);
    
    RAISE NOTICE 'Tables found: % of %', table_count, array_length(expected_tables, 1);
    
    -- List missing tables
    FOREACH table_name IN ARRAY expected_tables
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = table_name
        ) THEN
            missing_tables := missing_tables || table_name || ', ';
        END IF;
    END LOOP;
    
    IF missing_tables != '' THEN
        RAISE WARNING 'Missing tables: %', rtrim(missing_tables, ', ');
    ELSE
        RAISE NOTICE '✓ All tables created successfully';
    END IF;
END $$;

-- Check table row counts
SELECT 
    'positions' as table_name,
    COUNT(*) as row_count,
    CASE WHEN COUNT(*) >= 6 THEN '✓' ELSE '✗' END as status
FROM positions
UNION ALL
SELECT 
    'system_settings' as table_name,
    COUNT(*) as row_count,
    CASE WHEN COUNT(*) >= 20 THEN '✓' ELSE '✗' END as status
FROM system_settings
UNION ALL
SELECT 
    'public_holidays' as table_name,
    COUNT(*) as row_count,
    CASE WHEN COUNT(*) >= 10 THEN '✓' ELSE '✗' END as status
FROM public_holidays
UNION ALL
SELECT 
    'master_tasks' as table_name,
    COUNT(*) as row_count,
    CASE WHEN COUNT(*) >= 5 THEN '✓' ELSE '✗' END as status
FROM master_tasks;

-- ========================================
-- RLS POLICY VERIFICATION
-- ========================================

SELECT 
    'RLS Policies' as component,
    COUNT(*) as policy_count,
    CASE WHEN COUNT(*) >= 18 THEN '✓' ELSE '✗' END as status
FROM pg_policies 
WHERE schemaname = 'public';

-- List all RLS policies
SELECT 
    tablename,
    policyname,
    CASE 
        WHEN cmd = 'r' THEN 'SELECT'
        WHEN cmd = 'w' THEN 'UPDATE'
        WHEN cmd = 'a' THEN 'INSERT'
        WHEN cmd = 'd' THEN 'DELETE'
        WHEN cmd = '*' THEN 'ALL'
    END as command
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ========================================
-- INDEX VERIFICATION
-- ========================================

SELECT 
    'Indexes' as component,
    COUNT(*) as index_count,
    CASE WHEN COUNT(*) >= 24 THEN '✓' ELSE '✗' END as status
FROM pg_indexes 
WHERE schemaname = 'public'
AND indexname LIKE 'idx_%';

-- ========================================
-- VIEW VERIFICATION
-- ========================================

SELECT 
    'Views' as component,
    COUNT(*) as view_count,
    CASE WHEN COUNT(*) >= 3 THEN '✓' ELSE '✗' END as status
FROM information_schema.views 
WHERE table_schema = 'public';

-- List views
SELECT 
    table_name as view_name,
    '✓' as status
FROM information_schema.views 
WHERE table_schema = 'public'
ORDER BY table_name;

-- ========================================
-- FUNCTION VERIFICATION
-- ========================================

SELECT 
    'Functions' as component,
    COUNT(*) as function_count,
    CASE WHEN COUNT(*) >= 3 THEN '✓' ELSE '✗' END as status
FROM information_schema.routines 
WHERE routine_schema = 'public'
AND routine_type = 'FUNCTION';

-- List functions
SELECT 
    routine_name as function_name,
    '✓' as status
FROM information_schema.routines 
WHERE routine_schema = 'public'
AND routine_type = 'FUNCTION'
ORDER BY routine_name;

-- ========================================
-- TRIGGER VERIFICATION
-- ========================================

SELECT 
    'Triggers' as component,
    COUNT(*) as trigger_count,
    CASE WHEN COUNT(*) >= 5 THEN '✓' ELSE '✗' END as status
FROM information_schema.triggers 
WHERE trigger_schema = 'public';

-- ========================================
-- SAMPLE DATA VERIFICATION
-- ========================================

-- Check positions are properly named
SELECT 
    name,
    CASE WHEN name IN (
        'Pharmacist (Primary)',
        'Pharmacist (Supporting)', 
        'Pharmacy Assistants',
        'Dispensary Technicians',
        'DAA Packers',
        'Operational/Managerial'
    ) THEN '✓' ELSE '✗' END as valid_name
FROM positions
ORDER BY name;

-- Check system settings categories
SELECT 
    COUNT(*) FILTER (WHERE key LIKE 'timezone%' OR key LIKE 'business_%') as business_rules,
    COUNT(*) FILTER (WHERE key LIKE '%_cutoff%') as cutoff_settings,
    COUNT(*) FILTER (WHERE key LIKE 'auto_logout_%') as logout_settings,
    COUNT(*) FILTER (WHERE key LIKE 'task_generation_%') as generation_settings,
    COUNT(*) FILTER (WHERE is_public = true) as public_settings,
    COUNT(*) FILTER (WHERE is_public = false) as private_settings
FROM system_settings;

-- ========================================
-- SECURITY VERIFICATION
-- ========================================

-- Check RLS is enabled on all tables
SELECT 
    tablename,
    CASE WHEN rowsecurity THEN '✓ Enabled' ELSE '✗ Disabled' END as rls_status
FROM pg_class c
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public'
AND c.relkind = 'r'
AND c.relname IN (
    'positions', 'user_profiles', 'master_tasks', 'task_instances',
    'public_holidays', 'audit_log', 'system_settings', 
    'task_completion_log', 'notification_settings'
)
ORDER BY c.relname;

-- ========================================
-- FINAL SUMMARY
-- ========================================

DO $$
DECLARE
    table_count INTEGER;
    policy_count INTEGER;
    view_count INTEGER;
    function_count INTEGER;
    position_count INTEGER;
    setting_count INTEGER;
    all_good BOOLEAN := true;
BEGIN
    -- Count everything
    SELECT COUNT(*) INTO table_count FROM information_schema.tables WHERE table_schema = 'public';
    SELECT COUNT(*) INTO policy_count FROM pg_policies WHERE schemaname = 'public';
    SELECT COUNT(*) INTO view_count FROM information_schema.views WHERE table_schema = 'public';
    SELECT COUNT(*) INTO function_count FROM information_schema.routines WHERE routine_schema = 'public';
    SELECT COUNT(*) INTO position_count FROM positions;
    SELECT COUNT(*) INTO setting_count FROM system_settings;
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'SETUP VERIFICATION SUMMARY';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Tables: % (expected: 9+)', table_count;
    RAISE NOTICE 'RLS Policies: % (expected: 18+)', policy_count;
    RAISE NOTICE 'Views: % (expected: 3)', view_count;
    RAISE NOTICE 'Functions: % (expected: 3+)', function_count;
    RAISE NOTICE 'Positions: % (expected: 6)', position_count;
    RAISE NOTICE 'System Settings: % (expected: 20+)', setting_count;
    RAISE NOTICE '========================================';
    
    -- Check minimums
    IF table_count < 9 THEN all_good := false; END IF;
    IF policy_count < 18 THEN all_good := false; END IF;
    IF view_count < 3 THEN all_good := false; END IF;
    IF function_count < 3 THEN all_good := false; END IF;
    IF position_count < 6 THEN all_good := false; END IF;
    IF setting_count < 20 THEN all_good := false; END IF;
    
    IF all_good THEN
        RAISE NOTICE '✓ DATABASE SETUP SUCCESSFUL!';
        RAISE NOTICE 'Ready for application deployment.';
    ELSE
        RAISE WARNING '✗ SETUP INCOMPLETE!';
        RAISE WARNING 'Review the issues above.';
    END IF;
    
    RAISE NOTICE '========================================';
END $$;