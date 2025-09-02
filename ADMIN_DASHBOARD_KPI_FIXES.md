# Admin Dashboard KPI Fixes

## Issues Found and Fixed

### 1. **Selected Period Definition**

**Question**: What period is the selected period? When from, to?

**Answer**: 
- **Default period**: Last 7 days from today
- **From**: `today - 7 days` (e.g., if today is Jan 15, then Jan 8)
- **To**: `today` (e.g., Jan 15)
- **Filtering**: Tasks are filtered by `due_date` between these dates
- **API Call**: KPIWidgets calls `/api/dashboard` without date parameters, so always uses 7-day default

### 2. **Average Time to Complete showing 0h**

**Root Cause**: 
- Seed data created completed tasks with `status = 'done'` but **no `completed_at` timestamps**
- API filters out tasks without `completed_at`: `task.completed_at && task.instance_date`
- Result: Empty array → 0 hours average

**Fixes Applied**:
1. **Updated seed data** (`supabase/seed-data.sql`):
   - Added `completed_at` timestamps for all completed tasks
   - Added realistic completion times (some on-time, some late)

2. **Improved calculation logic** (`app/api/dashboard/route.ts`):
   - Changed from `created_at → completed_at` to `instance_date → completed_at`
   - More meaningful: measures time from when task became available to completion
   - Added `instance_date` and `due_time` to query selection

3. **Created fix script** (`scripts/fix-kpi-data.sql`):
   - Updates existing completed tasks to have `completed_at` timestamps
   - Can be run on existing databases

### 3. **Missed Tasks (7 days) showing 0**

**Root Cause**:
- Original seed data only had statuses: `'due_today'`, `'done'`, `'not_due'`, `'overdue'`
- **No tasks with `status = 'missed'`**
- Tasks only become `'missed'` through automated status update jobs

**Fixes Applied**:
1. **Updated seed data**:
   - Added several tasks with `status = 'missed'` from recent days
   - Spread across different days for realistic data

2. **Enhanced test data**:
   - 3 days ago: 2 missed tasks
   - 5 days ago: 1 missed task
   - Total: 3 missed tasks in last 7 days

### 4. **Total Completed Tasks**

**Issue**: Widget was showing `totalTasks` instead of `completedTasks`

**Fix Applied**: Already fixed in previous session
- Changed `data.summary.totalTasks` to `data.summary.completedTasks` in KPIWidgets

## Expected Results After Fixes

With the updated seed data, you should see:

1. **On-Time Completion Rate**: ~60-80% (some tasks completed on time, some late)
2. **Average Time to Complete**: ~2-15 hours (realistic completion times)
3. **Missed Tasks (7 days)**: 3 tasks
4. **Total Completed Tasks**: 6-8 tasks (depending on date range)

## How to Apply Fixes

### Option 1: Fresh Database Setup
```bash
# Run the updated seed data
# In Supabase Dashboard, run:
# 1. supabase/schema.sql
# 2. supabase/rls-policies.sql  
# 3. supabase/seed-data.sql (updated version)
```

### Option 2: Update Existing Database
```bash
# Run the fix script in Supabase Dashboard:
# scripts/fix-kpi-data.sql
```

### Option 3: Test Calculations
```bash
# Install dependencies and run test script
npm install
node scripts/test-kpi-calculations.js
```

## Verification Steps

1. **Check Database**:
   ```sql
   SELECT 
     status,
     COUNT(*) as count,
     COUNT(CASE WHEN completed_at IS NOT NULL THEN 1 END) as with_completed_at
   FROM task_instances 
   WHERE due_date >= CURRENT_DATE - 7
   GROUP BY status;
   ```

2. **Check Admin Dashboard**:
   - Navigate to `/admin`
   - Verify all 4 KPI widgets show non-zero values
   - Values should be realistic (not 0 or 100%)

3. **Check API Response**:
   ```bash
   # With proper authentication
   curl -H "Authorization: Bearer <token>" http://localhost:3001/api/dashboard
   ```

## Technical Details

### KPI Calculation Logic

1. **On-Time Completion Rate**:
   ```typescript
   onTimeCompletions = completed tasks where completed_at date <= due_date
   rate = (onTimeCompletions / totalCompletedTasks) * 100
   ```

2. **Average Time to Complete**:
   ```typescript
   timeToComplete = |completed_at - instance_date_00:00| in hours
   average = sum(timeToComplete) / count(completedTasksWithTimestamps)
   ```

3. **Missed Tasks (7 days)**:
   ```typescript
   missedTasks = tasks with status = 'missed' AND due_date in last 7 days
   ```

4. **Total Completed Tasks**:
   ```typescript
   completedTasks = tasks with status = 'done' AND due_date in last 7 days
   ```

### Date Range Logic
- **Filter**: `due_date >= (today - 7 days) AND due_date <= today`
- **Timezone**: Uses server timezone (should be Australian timezone)
- **Inclusive**: Both start and end dates are included

## Files Modified

1. `supabase/seed-data.sql` - Enhanced with realistic task data
2. `app/api/dashboard/route.ts` - Fixed calculation logic and query
3. `scripts/fix-kpi-data.sql` - Database fix script (new)
4. `scripts/test-kpi-calculations.js` - Test script (new)