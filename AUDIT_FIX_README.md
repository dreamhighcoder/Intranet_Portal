# Audit Log Constraint Fix

## Problem
When deleting public holidays, the system fails with the following error:
```
The audit log system needs to be updated to support holiday deletion. Please run the database migration to fix this issue.
```

This happens because the `audit_log` table has a constraint that only allows specific actions, and `holiday_deleted` is not in the allowed list.

## Solution Options

### Option 1: Use the Admin Interface (Recommended)
1. Go to `/admin/fix-audit` in your browser
2. Click "Apply Fix" 
3. Follow the instructions to run the SQL script in Supabase Dashboard

### Option 2: Run the Script
```bash
pnpm run fix-audit-constraint
```

### Option 3: Manual SQL Execution
1. Go to your Supabase Dashboard
2. Navigate to the SQL Editor
3. Copy and paste the contents of `supabase/fix-audit-constraint-manual.sql`
4. Execute the script

## What This Fix Does
- Removes the old constraint that only allowed basic task actions
- Adds a new constraint that includes holiday-related actions:
  - `holiday_created`
  - `holiday_updated` 
  - `holiday_deleted`
  - `holiday_sync`
- Ensures the audit trigger for public holidays works correctly
- Tests the constraint to verify it works

## Verification
After applying the fix, you should be able to:
1. Delete public holidays without errors
2. See audit log entries for holiday operations
3. View the audit trail in the admin interface

## Files Modified
- `supabase/schema.sql` - Updated with new constraint
- `app/api/admin/apply-audit-fix/route.ts` - New API endpoint
- `app/admin/fix-audit/page.tsx` - Updated to use new endpoint
- `scripts/fix-audit-constraint.js` - New script for automated fix
- `supabase/fix-audit-constraint-manual.sql` - Manual SQL script
- `package.json` - Added script command

## Technical Details
The constraint violation occurs because:
1. Public holiday deletion triggers an audit log entry
2. The trigger tries to insert `action: 'holiday_deleted'`
3. The old constraint only allowed basic task actions
4. PostgreSQL rejects the insert, causing the entire delete operation to fail

The fix expands the constraint to include all necessary actions for the application.

## Testing the Fix
1. Start the development server: `pnpm run dev`
2. Go to `/admin/public-holidays`
3. Try to delete a public holiday
4. If you get the constraint error, go to `/admin/fix-audit` and apply the fix
5. Try deleting the holiday again - it should work without errors