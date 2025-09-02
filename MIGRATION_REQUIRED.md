# 🚨 MIGRATION REQUIRED - Position-Specific Completion Fix

## Issue Identified ✅

The reason you're seeing "⏰ Due Today" instead of position-specific completion badges in the admin "All Responsibilities" view is because **the database migration has not been run yet**.

The code implementation is correct, but the required database tables and columns don't exist yet.

## ✅ What's Working
- ✅ Frontend logic is correctly implemented
- ✅ API endpoints are correctly implemented  
- ✅ Status badge rendering logic is correct
- ✅ Position completion detection is correct

## ❌ What's Missing
- ❌ `task_position_completions` table doesn't exist
- ❌ New columns in `task_instances` don't exist
- ❌ `task_completion_status` view doesn't exist

## 🚀 SOLUTION: Run the Database Migration

### Step 1: Access Supabase Dashboard
1. Go to: https://supabase.com/dashboard/project/oabhsaqryrldhqscntck
2. Navigate to **SQL Editor**

### Step 2: Execute the Migration
Copy and paste the following SQL code into the SQL Editor and execute it:

```sql
-- Migration: Add position-specific task completion tracking
-- Date: 2025-01-15
-- Description: Adds support for tracking task completion per position for shared tasks

-- Add new columns to task_instances for position-specific completion 
ALTER TABLE task_instances
ADD COLUMN IF NOT EXISTS completed_by_type TEXT CHECK (completed_by_type IN ('user', 'position')),
ADD COLUMN IF NOT EXISTS position_completions JSONB DEFAULT '{}';

-- Create a new table for position-specific task completions
CREATE TABLE IF NOT EXISTS task_position_completions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    task_instance_id UUID NOT NULL REFERENCES task_instances(id) ON DELETE CASCADE,
    position_id UUID REFERENCES positions(id) ON DELETE CASCADE,
    position_name TEXT NOT NULL, -- Store position name for historical tracking
    completed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    completed_at TIMESTAMPTZ NOT NULL,
    uncompleted_at TIMESTAMPTZ, -- Track when task was uncompleted
    is_completed BOOLEAN DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(task_instance_id, position_id) -- One completion record per task per position
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_task_position_completions_task_instance_id ON task_position_completions(task_instance_id);
CREATE INDEX IF NOT EXISTS idx_task_position_completions_position_id ON task_position_completions(position_id);
CREATE INDEX IF NOT EXISTS idx_task_position_completions_completed_at ON task_position_completions(completed_at);
CREATE INDEX IF NOT EXISTS idx_task_position_completions_is_completed ON task_position_completions(is_completed);

-- Add RLS policies for the new table
ALTER TABLE task_position_completions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view completions for their position or if they're admin
CREATE POLICY "Users can view position completions" ON task_position_completions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles up
            JOIN positions p ON up.position_id = p.id
            WHERE up.id = auth.uid()
            AND (p.id = position_id OR up.role = 'admin')
        )
    );

-- Policy: Users can insert completions for their own position
CREATE POLICY "Users can insert position completions" ON task_position_completions
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_profiles up
            WHERE up.id = auth.uid()
            AND up.position_id = position_id
        )
    );

-- Policy: Users can update completions for their own position or admins can update any
CREATE POLICY "Users can update position completions" ON task_position_completions
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM user_profiles up
            WHERE up.id = auth.uid()
            AND (up.position_id = position_id OR up.role = 'admin')
        )
    );

-- Policy: Only admins can delete completions
CREATE POLICY "Admins can delete position completions" ON task_position_completions
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_task_position_completions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_task_position_completions_updated_at
    BEFORE UPDATE ON task_position_completions
    FOR EACH ROW
    EXECUTE FUNCTION update_task_position_completions_updated_at();

-- Create a view for easy querying of position-specific completion status
CREATE OR REPLACE VIEW task_completion_status AS
SELECT
    ti.id as task_instance_id,
    ti.master_task_id,
    ti.instance_date,
    ti.due_date,
    ti.status as global_status,
    mt.title,
    mt.responsibility,
    COALESCE(
        jsonb_object_agg(
            tpc.position_name,
            jsonb_build_object(
                'completed', tpc.is_completed,
                'completed_at', tpc.completed_at,
                'completed_by', tpc.completed_by,
                'uncompleted_at', tpc.uncompleted_at
            )
        ) FILTER (WHERE tpc.position_name IS NOT NULL),
        '{}'::jsonb
    ) as position_completions
FROM task_instances ti
JOIN master_tasks mt ON ti.master_task_id = mt.id
LEFT JOIN task_position_completions tpc ON ti.id = tpc.task_instance_id
GROUP BY ti.id, ti.master_task_id, ti.instance_date, ti.due_date, ti.status, mt.title, mt.responsibility;

-- Add comments for documentation
COMMENT ON TABLE task_position_completions IS 'Position-specific completion tracking for shared tasks';
COMMENT ON COLUMN task_position_completions.task_instance_id IS 'Reference to the task instance';
COMMENT ON COLUMN task_position_completions.position_id IS 'Position that completed the task';
COMMENT ON COLUMN task_position_completions.position_name IS 'Position name for historical tracking';
COMMENT ON COLUMN task_position_completions.completed_by IS 'User who completed the task';
COMMENT ON COLUMN task_position_completions.completed_at IS 'When the task was completed';
COMMENT ON COLUMN task_position_completions.uncompleted_at IS 'When the task was uncompleted (if applicable)';
COMMENT ON COLUMN task_position_completions.is_completed IS 'Current completion status for this position';
COMMENT ON VIEW task_completion_status IS 'View showing task completion status per position';

-- Log the migration
DO $$
BEGIN
    RAISE NOTICE 'Migration completed: Added position-specific task completion tracking';
    RAISE NOTICE 'New table: task_position_completions';
    RAISE NOTICE 'New view: task_completion_status';
    RAISE NOTICE 'Added columns to task_instances: completed_by_type, position_completions';
END $$;
```

### Step 3: Verify Migration Success
After running the migration, you should see success messages in the SQL Editor output.

### Step 4: Test the Functionality
1. **Refresh your browser** (clear cache if needed)
2. **Create a test scenario:**
   - Create a shared task assigned to multiple positions
   - Complete it from one position
   - Check admin view with "All Responsibilities" filter
   - You should now see position-specific completion badges instead of "⏰ Due Today"

## 🎯 Expected Results After Migration

### ✅ Admin View - "All Responsibilities" Filter
- **Completed tasks:** Show position badges like "✓ Pharmacist Primary", "✓ Pharmacy Assistant"
- **Multiple completions:** Show truncation like "✓ Pharmacist Primary +1"
- **Pending tasks:** Show "⏰ Due Today" or "⚠️ Overdue"

### ✅ Admin View - Single Position Filter
- **Completed tasks:** Show "✓ Done" only if that specific position completed it
- **Pending tasks:** Show "⏰ Due Today" even if other positions completed it

### ✅ Regular User View
- **Completed tasks:** Show "✓ Done" only if their position completed it
- **Pending tasks:** Show "⏰ Due Today" even if other positions completed it

## 🔧 Verification Script
After migration, you can run this to verify everything is working:

```bash
node check-migration.js
```

This will test all the database tables, columns, views, and API endpoints.

## 🚨 If Migration Fails
If you encounter any errors during migration:

1. **Check the error message** in the SQL Editor
2. **Run statements individually** - copy each CREATE/ALTER statement separately
3. **Check permissions** - ensure you're using the service role key
4. **Contact support** if you need help with Supabase-specific issues

## 📞 Need Help?
If you encounter any issues:
1. Check the browser console for JavaScript errors
2. Check the network tab for API failures
3. Check server logs for backend errors
4. Run the verification script to identify specific problems

---

**Status: MIGRATION REQUIRED** 
**Next Step: Execute the SQL migration in Supabase Dashboard**