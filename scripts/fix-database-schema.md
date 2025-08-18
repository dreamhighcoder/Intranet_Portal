# Database Schema Fix Instructions

## Issue
The `default_due_time` column exists in the schema definition but is not recognized by the PostgREST schema cache. This causes errors when creating master tasks.

## Temporary Fix Applied
The API has been modified to gracefully handle this issue by retrying without the `default_due_time` field if the column is not found.

## Permanent Fix Required
To permanently resolve this issue, you need to refresh the database schema cache in Supabase:

### Option 1: Using Supabase Dashboard (Recommended)
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Run the following SQL commands:

```sql
-- Ensure the column exists
ALTER TABLE master_tasks ADD COLUMN IF NOT EXISTS default_due_time TIME;

-- Refresh the schema cache
NOTIFY pgrst, 'reload schema';
```

4. Wait 10-15 seconds for the schema cache to refresh
5. Try creating a master task again

### Option 2: Using Supabase CLI (if available)
```bash
supabase db reset
```

### Option 3: Manual Schema Refresh
If you have direct database access:
```sql
SELECT pg_notify('pgrst', 'reload schema');
```

## Verification
After applying the fix:
1. Try creating a new master task
2. Check that the `default_due_time` field is properly saved
3. Verify that the task appears correctly in the Master Tasks table

## Notes
- The temporary fix allows the application to continue working
- The `default_due_time` field will be set to NULL until the schema is properly refreshed
- All other functionality remains intact