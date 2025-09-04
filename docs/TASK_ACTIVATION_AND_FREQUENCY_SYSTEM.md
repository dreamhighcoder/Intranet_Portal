# Task Activation and Frequency System

## Overview

This document describes the complete task activation and frequency system for the Pharmacy Intranet Portal. The system handles 36 different frequency types and supports both manual and automatic task activation.

## Task Activation Flow

### 1. Task Creation
When an administrator creates a new task or imports it from Excel:
- Task starts with `publish_status = 'draft'` or `'inactive'`
- Optional `publish_delay` date can be set for automatic activation

### 2. Task Activation Methods

#### Manual Activation
- Administrator sets `publish_status = 'active'` immediately
- System immediately triggers frequency logic via the PUT endpoint
- Task instances are generated for current date and future dates as needed

#### Automatic Activation
- System runs daily cron job (`/api/jobs/activate-tasks`)
- Finds tasks with `publish_status IN ('draft', 'inactive')`
- Checks if `publish_delay <= current_date`
- Activates eligible tasks and triggers frequency logic immediately

### 3. Frequency Logic Trigger
When a task becomes active (manually or automatically):
1. System calls `runNewDailyGeneration()` 
2. Loads all active master tasks (filtered by `publish_delay`)
3. Processes each task's frequencies using the recurrence engine
4. Generates appropriate task instances based on frequency rules

## Database Schema

### Master Tasks Table
- `publish_status`: 'draft' | 'inactive' | 'active'
- `publish_delay`: Date when task should automatically become active (nullable)
- `frequencies`: Array of frequency strings (up to 36 types)
- `due_date`: Required for once-off tasks
- `sticky_once_off`: Boolean for sticky once-off behavior

### Task Instances Table
- `master_task_id`: Reference to master task
- `instance_date`: Date this instance appears
- `due_date`: When this instance is due
- `status`: 'pending' | 'in_progress' | 'overdue' | 'missed' | 'done'
- `locked`: Boolean indicating if instance can still be modified
- `is_carry_instance`: Boolean indicating if this is a carried-over instance

## 36 Frequency Types

### Basic Frequencies

#### 1. Once Off (`once_off`)
- **Appear**: On the day it becomes active
- **Carry**: Same instance appears every day until Done
- **Due**: Admin-specified due date (required)
- **Lock**: Never auto-locks, appears indefinitely until completed

#### 2. Once Off Sticky (`once_off_sticky`)
- Same as Once Off but with sticky behavior
- Remains visible even after completion for reference

#### 3. Every Day (`every_day`)
- **Appear**: New daily instance EXCLUDING Sundays & Public Holidays
- **Carry**: No carry; each day has its own instance
- **Due**: Same day as appearance
- **Lock**: Due time → Overdue; 23:59 same date → Missed + Lock

### Weekly Frequencies

#### 4. Once Weekly (`once_weekly`)
- **Appear**: Each Monday; if PH → Tuesday; if also PH → next non-PH weekday (same week)
- **Carry**: Same instance reappears daily through Saturday of that week
- **Due**: Saturday of that week; if PH → nearest earlier non-PH weekday (same week)
- **Lock**: Due time → Overdue; 23:59 on due date → Missed + Lock

#### 5-10. Specific Weekdays (`monday`, `tuesday`, `wednesday`, `thursday`, `friday`, `saturday`)
- **Appear**: On specified weekday
  - If PH and Tuesday-Saturday: nearest earlier non-PH weekday (same week); if none → next non-PH forward
  - If PH and Monday: next non-PH weekday forward (same week)
- **Carry**: Same instance reappears daily through Saturday of that week
- **Due**: The scheduled day's date (after PH shift)
- **Lock**: Due time → Overdue; 23:59 on Saturday → Missed + Lock

### Monthly Frequencies

#### 11. Start of Every Month (`start_of_every_month`)
- **Appear**: 1st of month; if Sat/Sun → first Monday after; if PH → next non-PH weekday
- **Carry**: Reappears daily until last Saturday of month (or earlier if PH)
- **Due**: 5 full workdays from appearance (excluding weekends & PHs)
- **Lock**: Due time → Overdue; 23:59 on last Saturday → Missed + Lock

#### 12-23. Start of Specific Months (`start_of_month_jan` through `start_of_month_dec`)
- Same rules as Start of Every Month but only for specified month
- **Appear**: 1st of specified month with same weekend/PH shifting
- **Carry**: Until last Saturday of that month
- **Due**: 5 full workdays from appearance

#### 24. Once Monthly (`once_monthly`)
- **Appear**: Same as Start of Every Month (weekend→Monday; PH→next weekday)
- **Carry**: Same instance reappears daily only up to due date (not past)
- **Due**: Last Saturday of month; if PH → nearest earlier non-PH weekday
- **Lock**: Due time → Overdue; 23:59 on due date → Missed + Lock

#### 25. End of Every Month (`end_of_every_month`)
- **Appear**: Last Monday of month; if <5 workdays remain → previous Monday; if PH → next non-PH weekday
- **Carry**: Reappears daily until Saturday of that week (not past due date)
- **Due**: Last Saturday of month; if PH → nearest earlier non-PH weekday
- **Lock**: Due time → Overdue; 23:59 on due date → Missed + Lock

#### 26-37. End of Specific Months (`end_of_month_jan` through `end_of_month_dec`)
- Same rules as End of Every Month but only for specified month
- **Appear**: Last Monday with ≥5 workdays remaining; PH shifting applies
- **Carry**: Until due date only
- **Due**: Last Saturday of specified month

## API Endpoints

### Task Activation
- `POST /api/jobs/activate-tasks` - Automatic activation cron job
- `PUT /api/master-tasks/[id]` - Manual activation (triggers frequency logic)

### Instance Generation
- `POST /api/jobs/generate-instances` - Daily instance generation
- Uses `runNewDailyGeneration()` from `lib/new-task-generator.ts`

### Testing
- `POST /api/test/task-activation` - Comprehensive testing endpoint
- Supports creating test tasks, testing activation, and cleanup

## Key Components

### 1. Task Database Adapter (`lib/task-database-adapter.ts`)
- `loadActiveMasterTasks(date)` - Loads active tasks past their publish_delay
- Filters tasks by `publish_status = 'active'` AND `(publish_delay IS NULL OR publish_delay <= date)`

### 2. New Recurrence Engine (`lib/new-recurrence-engine.ts`)
- `generateInstancesForDate()` - Main frequency logic processor
- `processTaskForDate()` - Handles individual frequency types
- Comprehensive implementation of all 36 frequency rules

### 3. New Task Generator (`lib/new-task-generator.ts`)
- `runNewDailyGeneration()` - Orchestrates the generation process
- Handles both new instances and carry instances
- Supports test mode and dry run options

## Holiday Handling

The system integrates with the Holiday Checker to:
- Skip Sundays and Public Holidays for daily tasks
- Shift appearance dates when scheduled days fall on holidays
- Adjust due dates and carry periods based on holiday rules

## Status Management

Task instances progress through statuses:
1. **Pending** - Initial state when created
2. **In Progress** - When user starts working on task
3. **Overdue** - Past due time but not yet locked
4. **Missed** - Past lock time, instance is locked
5. **Done** - Completed by user

## Testing

Use the test endpoint to verify the system:

```bash
# Create and test a daily task
POST /api/test/task-activation
{
  "action": "full_test",
  "frequency": "every_day",
  "testDate": "2024-01-15"
}

# Test automatic activation
POST /api/test/task-activation
{
  "action": "full_test", 
  "frequency": "once_weekly",
  "publishDelay": "2024-01-15",
  "testDate": "2024-01-15"
}

# Cleanup test data
POST /api/test/task-activation
{
  "action": "cleanup_test_data"
}
```

## Cron Job Setup

Set up daily cron jobs:

1. **Task Activation** (runs at 00:01 daily):
   ```bash
   curl -X POST https://your-domain/api/jobs/activate-tasks \
     -H "Authorization: Bearer YOUR_CRON_API_KEY"
   ```

2. **Instance Generation** (runs at 00:05 daily):
   ```bash
   curl -X POST https://your-domain/api/jobs/generate-instances \
     -H "Authorization: Bearer YOUR_CRON_API_KEY"
   ```

## Error Handling

The system includes comprehensive error handling:
- Failed activations are logged but don't stop the process
- Instance generation errors are captured per task
- Test endpoints provide detailed error information
- All operations support dry-run mode for testing

## Performance Considerations

- Database queries are optimized with proper indexing
- Bulk operations are used for instance creation
- Holiday checking is cached for performance
- Large date ranges can be processed in batches

## Monitoring

Monitor the system through:
- API response logs for activation and generation jobs
- Database metrics for instance creation rates
- Error logs for failed activations or generations
- Test endpoint results for validation