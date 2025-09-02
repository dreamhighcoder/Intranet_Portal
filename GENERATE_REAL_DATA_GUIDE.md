# Generate Real Data Guide

## Current Situation

Your admin dashboard KPIs are showing **0 values** because the database contains **mock/demo data** that was created for testing purposes. To see real operational data, you need to:

1. **Remove mock data** (optional)
2. **Generate real task instances** from your master task templates
3. **Complete some tasks** to see meaningful KPIs

## Step-by-Step Instructions

### Step 1: Access Admin Panel

1. **Open browser**: Go to `http://localhost:3001/admin`
2. **Login as admin**: Use your admin credentials
3. **Navigate to Background Jobs**: Click the new "Background Jobs" card

### Step 2: Remove Mock Data (Optional)

If you want to start completely fresh:

1. **Open Supabase Dashboard**: Go to your Supabase project
2. **Go to SQL Editor**: Click "SQL Editor" in the sidebar
3. **Run cleanup script**: Copy and paste this SQL:

```sql
-- Remove all existing task instances (they're all mock data)
DELETE FROM task_instances;

-- Verify cleanup
SELECT 
  'After cleanup' as status,
  COUNT(*) as task_instances_remaining
FROM task_instances;
```

### Step 3: Generate Real Tasks

1. **In Admin Panel**: Go to `/admin/jobs`
2. **Click "Run Daily Generation"**: This will generate real task instances
3. **Wait for completion**: You'll see a success message with statistics
4. **Click "Update All Statuses"**: This updates task statuses based on current time

### Step 4: Verify Real Data

1. **Check Admin Dashboard**: Go back to `/admin`
2. **View KPI Widgets**: Should now show real values:
   - **On-Time Completion Rate**: Will be 0% initially (no completed tasks yet)
   - **Average Time to Complete**: Will be 0h initially
   - **Missed Tasks (7 days)**: May show some tasks if any are overdue
   - **Total Completed Tasks**: Will be 0 initially

### Step 5: Complete Some Tasks (To See Meaningful KPIs)

1. **Go to Checklists**: Click "Position Checklists" from admin dashboard
2. **Select a position**: Choose any position (e.g., Pharmacist, Technician)
3. **Complete some tasks**: Mark a few tasks as complete
4. **Return to Admin Dashboard**: KPIs will now show real completion data

## What Each KPI Means

### 1. **On-Time Completion Rate**
- **Calculation**: (Tasks completed by due date) / (Total completed tasks) × 100
- **Real Data**: Will show actual performance once tasks are completed
- **Example**: If 8 out of 10 completed tasks were done on time = 80%

### 2. **Average Time to Complete**
- **Calculation**: Average hours from when task becomes available to completion
- **Real Data**: Shows how long staff actually take to complete tasks
- **Example**: If tasks take 2-6 hours on average = 4.2h

### 3. **Missed Tasks (7 days)**
- **Calculation**: Count of tasks with status = 'missed' in last 7 days
- **Real Data**: Shows tasks that weren't completed and are now locked
- **Example**: 3 tasks were missed this week

### 4. **Total Completed Tasks**
- **Calculation**: Count of tasks with status = 'done' in last 7 days
- **Real Data**: Shows productivity/workload
- **Example**: 25 tasks completed this week

## Expected Timeline for Real Data

### **Immediately After Generation**:
- Tasks will be created with appropriate statuses (not_due, due_today, overdue)
- KPIs will show mostly 0 values (no completions yet)

### **After 1 Day of Use**:
- Staff complete some tasks
- On-Time Completion Rate shows real percentages
- Average Time to Complete shows real hours

### **After 1 Week of Use**:
- All KPIs show meaningful operational data
- Historical trends become visible
- Performance patterns emerge

## Automation Setup (Recommended)

For ongoing operation, set up automated task generation:

### **Daily Task Generation** (12:00 AM):
```bash
# Add to cron job or use Supabase Edge Functions
curl -X POST "$NEXT_PUBLIC_SITE_URL/api/jobs/generate-instances" \
  -H "Authorization: Bearer $CRON_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"mode":"daily"}'
```

### **Status Updates** (Every 30 minutes):
```bash
curl -X POST "$NEXT_PUBLIC_SITE_URL/api/jobs/update-statuses" \
  -H "Authorization: Bearer $CRON_API_KEY"
```

## Troubleshooting

### **KPIs Still Show 0 After Generation**:
- **Cause**: No tasks have been completed yet
- **Solution**: Complete some tasks via the checklist interface

### **No Tasks Generated**:
- **Cause**: No active master tasks or incorrect recurrence patterns
- **Solution**: Check `/admin/master-tasks` and ensure tasks are active

### **Generation Fails**:
- **Cause**: Authentication or database issues
- **Solution**: Check browser console for errors, verify admin permissions

## Files Modified

1. **Added Background Jobs link** to admin dashboard (`app/admin/page.tsx`)
2. **Fixed KPI calculations** in dashboard API (`app/api/dashboard/route.ts`)
3. **Created cleanup scripts** for removing mock data

## Next Steps

1. **Generate real tasks** using the admin interface
2. **Train staff** to use the checklist system daily
3. **Monitor KPIs** to track operational performance
4. **Set up automation** for ongoing task generation

The system is now ready to collect and display **real operational data** instead of mock data!