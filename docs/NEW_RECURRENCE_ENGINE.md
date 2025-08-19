# New Task Recurrence & Status Engine

This document describes the implementation of the new task recurrence and status engine that provides deterministic logic for generating task instances and managing due dates, carry behavior, public holiday exceptions, and status transitions.

## Overview

The new recurrence engine implements precise rules for 7 frequency types with exact specifications for appearance, carry behavior, due calculation, and status/lock timing.

## Frequency Types

### 1. Once Off
- **Appear**: On the day it's first eligible (active & after publish_at), create one instance immediately
- **Carry**: Same instance appears every day until Done
- **Due date**: Admin enters manually (required)
- **Due time**: Default timing unless override
- **Status**: At due time → Overdue (stay unlocked). Keep appearing indefinitely until Done (no auto-miss/lock)

### 2. Every Day
- **Appear**: New daily instance on each eligible day EXCLUDING Sundays & PHs (skip; do not reallocate)
- **Carry**: No carry; each day has its own instance
- **Due date**: Same day
- **Due time**: Default timing unless override
- **Status**: Due time → Overdue; 23:59 same date → Missed + Lock; does not appear after due date

### 3. Once Weekly (anchored Monday)
- **Appear**: New instance each Monday
  - If Monday is PH → Tuesday
  - If Tuesday also PH → next latest weekday forward in the same week that is not PH
- **Carry**: Same instance reappears daily up to and including Saturday of that week
  - If Saturday is PH → due moves to the nearest earlier non-PH weekday of that week; that becomes the last day it can appear
- **Due date**: Saturday of that week; if PH, nearest earlier non-PH weekday (same week)
- **Due time**: Default timing unless override
- **Status**: Due time → Overdue; 23:59 on due date → Missed + Lock; no carry into next week

### 4. Every Mon/Tue/Wed/Thu/Fri/Sat (per selected weekday)
- **Appear**: New instance on the specified weekday
  - If target weekday is PH:
    - For Tue–Sat: appear on nearest earlier non-PH weekday in the same week; if none earlier, appear on the next latest non-PH weekday forward
    - For Mon: appear on the next latest non-PH weekday forward
- **Carry**: Same instance keeps reappearing daily up to and including Saturday of that week
  - If Saturday is PH, stop on the nearest earlier non-PH weekday that week
  - This instance continues appearing even after its due date until the Saturday cutoff (or earlier PH stop) or until Done, whichever is first
- **Due date**: The scheduled day's date (after any PH shift)
- **Due time**: Default timing unless override
- **Status**: Due time → Overdue (unlocked). Keep showing until 23:59 on Saturday cutoff (subject to PH stop) → Missed + Lock

### 5. Start of Month (Start of Jan…Dec)
- **Appear**: On the 1st of each month
  - If 1st is Sat/Sun → first Monday after the 1st
  - If that day is PH → next latest non-PH weekday forward
- **Carry**: Same instance reappears daily up to and including the last Saturday of the month
  - If that Saturday is PH, stop on the nearest earlier non-PH weekday of the month
  - This instance continues appearing even after its due date until that month's cutoff (or earlier PH stop) or until Done
- **Due date**: Give 5 full workdays from appearance, excluding weekends & PHs. If the computed due date lands on a PH, extend to the day after the PH
- **Due time**: Default timing unless override
- **Status**: Due time → Overdue (unlocked). Keep showing until 23:59 on the last Saturday of the month (subject to PH stop) → Missed + Lock

### 6. Once Monthly
- **Appear**: Same appearance rule as Start of Month (monthly, with weekend→Monday substitution; PH → next non-PH forward)
- **Carry**: Same instance reappears daily only up to and including its due date day; does not appear past due date
- **Due date**: Last Saturday of the month; if that Saturday is PH, use nearest earlier non-PH weekday
- **Due time**: Default timing unless override
- **Status**: Due time → Overdue; 23:59 on due date → Missed + Lock

### 7. End of Month (End of Jan…Dec)
- **Appear**: On the last Monday of the month unless that leaves < 5 full workdays (excl. weekends/PH) before month-end; if so, use the Monday prior
  - If that Monday prior is PH → next latest non-PH weekday forward
- **Carry**: Same as Once Monthly (shows through its due date day, not past)
- **Due date**: Last Saturday of the month; if PH, nearest earlier non-PH weekday
- **Due time**: Default timing unless override
- **Status**: Due time → Overdue; 23:59 on due date → Missed + Lock

## Implementation

### Core Classes

#### `NewRecurrenceEngine`
Main engine class that handles all frequency types with holiday shifting.

```typescript
class NewRecurrenceEngine {
  generateInstancesForDate(masterTasks: MasterTask[], date: string): GenerationResult
  updateInstanceStatuses(instances: TaskInstance[], currentDateTime: Date): StatusUpdateResult[]
}
```

#### `NewTaskGenerator`
Service class that integrates the recurrence engine with the database.

```typescript
class NewTaskGenerator {
  async generateForDate(options: NewGenerationOptions): Promise<NewGenerationResult>
  async generateForDateRange(options: BulkNewGenerationOptions): Promise<BulkNewGenerationResult>
  async updateStatusesForDate(date: string, testMode?: boolean): Promise<StatusUpdateResult>
}
```

#### `RecurrenceMigrationService`
Handles migration from the old frequency system to the new engine.

```typescript
class RecurrenceMigrationService {
  convertMasterTask(oldTask: MasterChecklistTask): MasterTask
  generateMigrationReport(oldTasks: MasterChecklistTask[]): MigrationReport
  validateMigration(oldTasks: MasterChecklistTask[]): ValidationResult
}
```

### API Endpoints

#### Generate Instances (New Engine)
```
POST /api/jobs/generate-instances-new
GET /api/jobs/generate-instances-new?date=2024-03-18&testMode=true
```

#### Update Statuses (New Engine)
```
POST /api/jobs/update-statuses-new
GET /api/jobs/update-statuses-new?date=2024-03-18&testMode=true
```

#### Migration Tools
```
GET /api/admin/migrate-recurrence?action=report
GET /api/admin/migrate-recurrence?action=validate
POST /api/admin/migrate-recurrence {"action": "execute", "testMode": true}
```

## Status Transitions

### Status Flow
1. **Pending** → **Overdue** (at due time on due date, unlocked)
2. **Overdue** → **Missed** (at cutoff time, locked)
3. **Pending/In Progress** → **Missed** (at cutoff time, locked)

### Locking Rules
- **Once Off**: Never auto-locks
- **Every Day**: Locks at 23:59 same date
- **Once Weekly/Once Monthly/End of Month**: Lock at 23:59 on due date
- **Specific Weekdays/Start of Month**: Lock at Saturday cutoff (or earlier PH stop)

## Testing

### Test Suite
Comprehensive test suite covering all frequency types and edge cases:

```bash
# Run tests
npm run test:recurrence

# Or manually
npx tsx scripts/test-new-recurrence-engine.ts
```

### Test Coverage
- ✅ All 7 frequency types
- ✅ Public holiday shifting
- ✅ Weekend handling
- ✅ Status transitions
- ✅ Locking behavior
- ✅ Edge cases (inactive tasks, missing data, etc.)

## Migration Guide

### Step 1: Validate Current Data
```bash
curl "http://localhost:3000/api/admin/migrate-recurrence?action=validate"
```

### Step 2: Generate Migration Report
```bash
curl "http://localhost:3000/api/admin/migrate-recurrence?action=report"
```

### Step 3: Preview Migration
```bash
curl "http://localhost:3000/api/admin/migrate-recurrence?action=preview"
```

### Step 4: Execute Migration (Test Mode)
```bash
curl -X POST "http://localhost:3000/api/admin/migrate-recurrence" \
  -H "Content-Type: application/json" \
  -d '{"action": "execute", "testMode": true}'
```

### Step 5: Execute Migration (Production)
```bash
curl -X POST "http://localhost:3000/api/admin/migrate-recurrence" \
  -H "Content-Type: application/json" \
  -d '{"action": "execute", "testMode": false}'
```

## Usage Examples

### Generate Tasks for Today
```typescript
import { createNewTaskGenerator } from '@/lib/new-task-generator'

const generator = createNewTaskGenerator(publicHolidays)
const result = await generator.generateForDate({
  date: '2024-03-18',
  testMode: false,
  useNewEngine: true
})
```

### Update Task Statuses
```typescript
const statusResult = await generator.updateStatusesForDate('2024-03-18')
console.log(`Updated ${statusResult.instancesUpdated} instances`)
```

### Bulk Generation
```typescript
const bulkResult = await generator.generateForDateRange({
  startDate: '2024-03-01',
  endDate: '2024-03-31',
  useNewEngine: true
})
```

## Configuration

### Environment Variables
```env
# Enable new recurrence engine (default: false)
USE_NEW_RECURRENCE_ENGINE=true

# Business timezone for status calculations
BUSINESS_TIMEZONE=Australia/Sydney

# Default due times
DEFAULT_OPENING_TIME=08:00
DEFAULT_CLOSING_TIME=17:00
```

### Feature Flags
The new engine can be enabled/disabled per request:
- `useNewEngine: true` - Use new recurrence engine
- `useNewEngine: false` - Use legacy engine (fallback)

## Performance Considerations

### Optimizations
- Efficient date calculations using native Date objects
- Minimal database queries (bulk operations)
- Caching of public holiday data
- Lazy loading of master tasks

### Monitoring
- Generation time tracking
- Error rate monitoring
- Instance creation metrics
- Status update performance

## Troubleshooting

### Common Issues

#### Tasks Not Appearing
1. Check if task is active: `publish_status = 'active'`
2. Check publish delay: `publish_delay <= current_date`
3. Verify frequency mapping in migration
4. Check public holiday exclusions

#### Incorrect Due Dates
1. Verify workday calculations
2. Check public holiday shifting logic
3. Validate month boundary handling
4. Review weekend shifting rules

#### Status Not Updating
1. Check current time vs due time
2. Verify locking rules for frequency type
3. Check timezone configuration
4. Review cutoff calculations

### Debug Mode
Enable debug logging:
```typescript
const generator = createNewTaskGenerator(holidays, 'debug')
```

### Test Mode
Always test changes in test mode first:
```typescript
const result = await generator.generateForDate({
  date: '2024-03-18',
  testMode: true, // No database changes
  dryRun: true    // Show what would be generated
})
```

## Future Enhancements

### Planned Features
- [ ] Custom business calendars per location
- [ ] Flexible workday definitions
- [ ] Advanced recurrence patterns
- [ ] Task dependency management
- [ ] Bulk status operations
- [ ] Performance analytics dashboard

### API Versioning
The new engine is designed to coexist with the legacy system:
- Legacy endpoints: `/api/jobs/generate-instances`
- New endpoints: `/api/jobs/generate-instances-new`
- Migration tools: `/api/admin/migrate-recurrence`

This allows for gradual migration and rollback capabilities.