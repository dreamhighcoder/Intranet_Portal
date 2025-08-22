# Task Recurrence & Status Engine

## Overview

The Task Recurrence & Status Engine is a comprehensive implementation of deterministic logic that generates task instances from Master Checklist Frequencies and manages due dates/times, carry behavior, public-holiday/weekend exceptions, and status transitions.

## Implementation Files

- **`lib/task-recurrence-status-engine.ts`** - Main engine implementation
- **`lib/new-task-generator.ts`** - Task generator using the complete engine
- **`app/api/jobs/generate-instances/route.ts`** - API endpoint for task generation
- **`app/api/jobs/update-statuses/route.ts`** - API endpoint for status updates
- **`lib/__tests__/task-recurrence-status-engine.test.ts`** - Unit tests
- **`scripts/test-recurrence-engine.ts`** - Manual testing script

## Frequency Types

The engine implements 9 frequency types with exact specifications:

### 1. Once Off
- **Appearance**: On the day it's first eligible (active & after publish_at), create one instance immediately
- **Carry**: Same instance appears every day until Done
- **Due date**: Admin enters manually (required)
- **Due time**: Default timing unless override
- **Locking**: Never auto-locks - keeps appearing indefinitely until Done

### 2. Every Day
- **Appearance**: New daily instance on each eligible day EXCLUDING Sundays & PHs (skip; do not reallocate)
- **Carry**: No carry; each day has its own instance
- **Due date**: Same day
- **Due time**: Default timing unless override
- **Locking**: Due time → Overdue; 23:59 same date → Missed + Lock; does not appear after due date

### 3. Once Weekly (anchored Monday)
- **Appearance**: New instance each Monday
  - If Monday is PH → Tuesday
  - If Tuesday also PH → next latest weekday forward in the same week that is not PH
- **Carry**: Same instance reappears daily up to and including Saturday of that week
  - If Saturday is PH → due moves to the nearest earlier non-PH weekday of that week; that becomes the last day it can appear
- **Due date**: Saturday of that week; if PH, nearest earlier non-PH weekday (same week)
- **Due time**: Default timing unless override
- **Locking**: Due time → Overdue; 23:59 on due date → Missed + Lock; no carry into next week

### 4. Every Mon/Tue/Wed/Thu/Fri/Sat (per selected weekday)
- **Appearance**: New instance on the specified weekday
  - If target weekday is PH:
    - For Tue–Sat: appear on nearest earlier non-PH weekday in the same week; if none earlier, appear on the next latest non-PH weekday forward
    - For Mon: appear on the next latest non-PH weekday forward
- **Carry**: Same instance keeps reappearing daily up to and including Saturday of that week
  - If Saturday is PH, stop on the nearest earlier non-PH weekday that week
  - This instance continues appearing even after its due date until the Saturday cutoff (or earlier PH stop) or until Done, whichever is first
- **Due date**: The scheduled day's date (after any PH shift)
- **Due time**: Default timing unless override
- **Locking**: Due time → Overdue (unlocked). Keep showing until 23:59 on Saturday cutoff (subject to PH stop) → Missed + Lock

### 5. Start of Every Month
- **Appearance**: New instance on the 1st of each month
  - If the 1st is Sat/Sun → shift to the first Monday after
  - If that day is a PH → shift to the next weekday that is not a PH
- **Carry**: Same instance reappears daily up to and including the last Saturday of the month
  - If that Saturday is a PH → stop on the nearest earlier non-PH weekday of the month
  - This instance continues appearing even after its due date until that month's cutoff (or earlier PH stop) or until Done
- **Due date**: Give 5 full workdays from appearance, excluding weekends & PHs
  - If the computed due date lands on a PH → extend to the day after the PH
- **Due time**: Default timing unless override
- **Locking**: Due time → Overdue (unlocked). Keep showing until 23:59 on the last Saturday of the month (subject to PH stop) → Missed + Lock

### 6. Start of January/February/March/etc.
- **Appearance**: New instance on the specified month
  - If 1st is Sat/Sun → first Monday after the 1st
  - If that day is PH → next latest non-PH weekday forward
- **Carry**: Same instance reappears daily up to and including the last Saturday of the month
  - If that Saturday is PH, stop on the nearest earlier non-PH weekday of the month
  - This instance continues appearing even after its due date until that month's cutoff (or earlier PH stop) or until Done
- **Due date**: Give 5 full workdays from appearance, excluding weekends & PHs. If the computed due date lands on a PH, extend to the day after the PH
- **Due time**: Default timing unless override
- **Locking**: Due time → Overdue (unlocked). Keep showing until 23:59 on the last Saturday of the month (subject to PH stop) → Missed + Lock

### 7. Once Monthly
- **Appearance**: Same appearance rule as Start of Month (monthly, with weekend→Monday substitution; PH → next non-PH forward)
- **Carry**: Same instance reappears daily only up to and including its due date day; does not appear past due date
- **Due date**: Last Saturday of the month; if that Saturday is PH, use nearest earlier non-PH weekday
- **Due time**: Default timing unless override
- **Locking**: Due time → Overdue; 23:59 on due date → Missed + Lock

### 8. End of Every Month
- **Appearance**: New instance on the last Monday of the month
  - If that Monday leaves <5 full workdays before month end → shift to the Monday prior
  - If that Monday (or substituted Monday) is a PH → shift to the next weekday that is not a PH
- **Carry**: Same instance reappears daily up to and including the Saturday of that week
  - If that Saturday is a PH → stop on the nearest earlier non-PH weekday in that same week
  - This instance does not continue appearing after its due date
- **Due date**: Last Saturday of the month
  - If that Saturday is a PH → shift to the nearest earlier non-PH weekday
- **Due time**: Default timing unless override
- **Locking**: Due time → Overdue. At 23:59 on the same due date → Missed + Lock

### 9. End of January/February/March/etc.
- **Appearance**: On the last Monday of the month unless that leaves < 5 full workdays (excl. weekends/PH) before month-end; if so, use the Monday prior
  - If that Monday prior is PH → next latest non-PH weekday forward
- **Carry**: Same as Once Monthly (shows through its due date day, not past)
- **Due date**: Last Saturday of the month; if PH, nearest earlier non-PH weekday
- **Due time**: Default timing unless override
- **Locking**: Due time → Overdue; 23:59 on due date → Missed + Lock

## Status Transitions

### Status Types
- **PENDING**: Initial status when instance is created
- **IN_PROGRESS**: Task has been started but not completed
- **OVERDUE**: Past due time but not yet locked
- **MISSED**: Past locking cutoff, instance is locked
- **DONE**: Task completed successfully

### Transition Rules
1. **At due time on due date**: PENDING/IN_PROGRESS → OVERDUE (unlocked)
2. **At locking cutoff**: OVERDUE/PENDING/IN_PROGRESS → MISSED (locked)
3. **Manual completion**: Any status → DONE
4. **Never transition**: DONE tasks are never automatically changed

### Locking Cutoffs by Frequency
- **Once Off**: Never auto-locks
- **Every Day**: 23:59 same date
- **Once Weekly**: 23:59 on due date
- **Every Mon-Sat**: 23:59 on Saturday cutoff (or earlier PH stop)
- **Start of Month**: 23:59 on last Saturday of month (or earlier PH stop)
- **Once Monthly**: 23:59 on due date
- **End of Month**: 23:59 on due date

## Holiday Handling

### Skip vs Shift Behavior
- **Skip**: No replacement day (Every Day skips Sundays/PHs)
- **Shift**: Move to specified alternate day (other frequencies)

### Shifting Rules
- **Weekend → Monday**: If 1st of month is weekend, shift to first Monday after
- **PH → Next weekday**: If shifted day is PH, move to next non-PH weekday
- **Nearest earlier**: For due dates, find nearest earlier non-PH weekday in same period
- **Next forward**: For appearance dates, find next non-PH weekday forward

## API Usage

### Generate Task Instances
```bash
# POST /api/jobs/generate-instances
curl -X POST /api/jobs/generate-instances \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2024-03-15",
    "testMode": false,
    "dryRun": false,
    "forceRegenerate": false
  }'
```

### Update Task Statuses
```bash
# POST /api/jobs/update-statuses
curl -X POST /api/jobs/update-statuses \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2024-03-15",
    "testMode": false,
    "dryRun": false
  }'
```

## Database Schema

### Master Tasks
```sql
CREATE TABLE master_tasks (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  timing TEXT, -- Default due time
  frequencies TEXT[], -- Array of frequency types
  publish_delay DATE, -- No instances before this date
  due_date DATE, -- For once-off tasks
  start_date DATE, -- When task becomes active
  end_date DATE, -- When task expires
  publish_status TEXT DEFAULT 'active'
);
```

### Task Instances
```sql
CREATE TABLE task_instances (
  id UUID PRIMARY KEY,
  master_task_id UUID REFERENCES master_tasks(id),
  instance_date DATE NOT NULL,
  due_date DATE NOT NULL,
  due_time TIME,
  status TEXT DEFAULT 'pending',
  locked BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP,
  completed_by TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## Testing

### Unit Tests
Run the comprehensive test suite:
```bash
npm test lib/__tests__/task-recurrence-status-engine.test.ts
```

### Manual Testing
Run the manual test script:
```bash
npx tsx scripts/test-recurrence-engine.ts
```

### Test Coverage
The tests verify:
- All 9 frequency types with exact behavior
- Holiday shifting logic
- Status transitions and locking rules
- Carry behavior vs new instances
- Edge cases (inactive tasks, future publish dates, etc.)

## Configuration

### Environment Variables
- `CRON_API_KEY`: API key for automated job endpoints
- `DATABASE_URL`: Supabase database connection

### Business Rules
- **Timezone**: Australia/Sydney (configurable)
- **Business Days**: Monday-Friday (excluding public holidays)
- **Workday Calculation**: Excludes weekends and public holidays
- **Locking Time**: 23:59 in business timezone

## Monitoring and Logging

### Generation Results
Each generation returns detailed statistics:
- Total tasks processed
- New instances created
- Carry instances continued
- Errors encountered
- Execution time

### Status Update Results
Each status update returns:
- Total instances processed
- Instances updated
- Instances skipped
- Lock transitions
- Error details

### Audit Trail
All task actions are logged in the audit_log table with:
- User/position identification
- Action type and timestamp
- Old and new values
- Metadata and context

## Performance Considerations

### Optimization Strategies
1. **Batch Processing**: Process multiple tasks in single database transactions
2. **Indexing**: Proper indexes on date, status, and master_task_id columns
3. **Caching**: Cache public holiday data and frequency calculations
4. **Parallel Processing**: Process independent date ranges in parallel

### Scalability
- Engine is stateless and can be horizontally scaled
- Database operations use efficient queries with proper indexing
- Memory usage is minimal with streaming processing for large datasets

## Troubleshooting

### Common Issues
1. **Missing Instances**: Check publish_delay and active status
2. **Wrong Due Dates**: Verify holiday data and workday calculations
3. **Status Not Updating**: Check locking rules and current time
4. **Holiday Shifting**: Verify public holiday data is current

### Debug Mode
Enable debug logging by setting logLevel to 'debug' in the generator options.

### Validation
Use the test mode and dry run options to validate behavior before applying changes to production data.