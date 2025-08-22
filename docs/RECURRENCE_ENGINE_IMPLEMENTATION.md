# Task Recurrence & Status Engine Implementation

## Overview

This document describes the complete implementation of the Task Recurrence & Status Engine for the Pharmacy Intranet Portal. The engine provides deterministic logic for generating task instances from Master Checklist templates and managing due dates/times, carry behavior, public holiday/weekend exceptions, and status transitions.

## Architecture

### Core Components

1. **TaskRecurrenceStatusEngine** (`lib/task-recurrence-status-engine.ts`)
   - Main engine class implementing all frequency patterns
   - Handles instance generation and status updates
   - Integrates with public holiday checking

2. **TaskDatabaseAdapter** (`lib/task-database-adapter.ts`)
   - Bridges database schema and engine interface
   - Handles data transformation and mapping
   - Provides clean abstraction layer

3. **NewTaskGenerator** (`lib/new-task-generator.ts`)
   - High-level orchestration class
   - Manages database operations and error handling
   - Provides logging and result reporting

4. **API Endpoints**
   - `/api/jobs/generate-instances-new` - Instance generation
   - `/api/jobs/update-statuses-new` - Status updates

### Key Features

- **Complete Frequency Support**: All 26 frequency patterns implemented
- **Holiday Integration**: Automatic holiday checking and date shifting
- **Status Management**: Precise timing for Overdue/Missed/Locked transitions
- **Carry Behavior**: Proper instance continuation across days
- **Database Integration**: Seamless integration with existing schema
- **API Integration**: RESTful endpoints for external access

## Frequency Patterns

### 1. Once Off
- **Appear**: On first eligible day (active & after publish_at)
- **Carry**: Same instance appears daily until Done
- **Due**: Admin-specified date
- **Lock**: Never auto-locks

### 2. Every Day
- **Appear**: Daily excluding Sundays & Public Holidays (skip, no reallocation)
- **Carry**: No carry, each day has own instance
- **Due**: Same day
- **Lock**: 23:59 same date → Missed + Lock

### 3. Once Weekly
- **Appear**: Monday (if PH → Tuesday → next non-PH weekday)
- **Carry**: Daily through Saturday of same week
- **Due**: Saturday (or nearest earlier non-PH weekday)
- **Lock**: 23:59 on due date → Missed + Lock

### 4. Specific Weekdays (Mon-Sat)
- **Appear**: Target weekday (with PH shifting rules)
- **Carry**: Daily through Saturday of same week
- **Due**: Scheduled day after PH shift
- **Lock**: 23:59 on Saturday → Missed + Lock

### 5. Start of Every Month
- **Appear**: 1st (if weekend → first Monday; if PH → next non-PH)
- **Carry**: Daily through last Saturday of month
- **Due**: +5 workdays from appearance
- **Lock**: 23:59 on last Saturday → Missed + Lock

### 6. Start of Specific Months
- **Appear**: Same as Start of Every Month, but only in specified months
- **Carry**: Same as Start of Every Month
- **Due**: Same as Start of Every Month
- **Lock**: Same as Start of Every Month

### 7. Once Monthly
- **Appear**: Same as Start of Month
- **Carry**: Only through due date (no carry past due)
- **Due**: Last Saturday of month (or nearest earlier non-PH)
- **Lock**: 23:59 on due date → Missed + Lock

### 8. End of Every Month
- **Appear**: Last Monday with ≥5 workdays remaining
- **Carry**: Through Saturday of same week only
- **Due**: Last Saturday of month
- **Lock**: 23:59 on due date → Missed + Lock

### 9. End of Specific Months
- **Appear**: Same as End of Every Month, but only in specified months
- **Carry**: Same as End of Every Month
- **Due**: Same as End of Every Month
- **Lock**: Same as End of Every Month

## Status Transitions

### Status Types
- **PENDING**: Initial state, not yet due
- **IN_PROGRESS**: Manually set by user
- **OVERDUE**: Past due time but not locked
- **MISSED**: Past lock cutoff, automatically locked
- **DONE**: Completed by user

### Transition Rules
1. **At due time on due date**: PENDING → OVERDUE (unlocked)
2. **At lock cutoff**: OVERDUE → MISSED + LOCKED
3. **Manual completion**: Any status → DONE
4. **Manual uncomplete**: DONE → PENDING/OVERDUE (based on current time)

### Lock Cutoffs by Frequency
- **Every Day**: 23:59 same date
- **Once Weekly**: 23:59 on due date
- **Weekday Specific**: 23:59 on Saturday (or earlier PH stop)
- **Start of Month**: 23:59 on last Saturday of month
- **Once Monthly/End of Month**: 23:59 on due date
- **Once Off**: Never auto-locks

## Database Schema

### Master Tasks Table
```sql
CREATE TABLE master_tasks (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  frequencies TEXT[] NOT NULL, -- New multi-frequency array
  timing TEXT DEFAULT 'opening',
  due_time TIME,
  publish_status TEXT DEFAULT 'active',
  publish_delay DATE, -- No instances before this date
  start_date DATE,
  end_date DATE,
  due_date DATE, -- For once-off tasks
  -- ... other columns
);
```

### Task Instances Table
```sql
CREATE TABLE task_instances (
  id UUID PRIMARY KEY,
  master_task_id UUID REFERENCES master_tasks(id),
  instance_date DATE NOT NULL, -- When instance appears
  due_date DATE NOT NULL,
  due_time TIME,
  status TEXT DEFAULT 'pending',
  locked BOOLEAN DEFAULT FALSE,
  is_carry_instance BOOLEAN DEFAULT FALSE,
  original_appearance_date DATE,
  due_date_override DATE,
  due_time_override TIME,
  -- ... other columns
);
```

## API Usage

### Generate Instances
```bash
# Generate instances for a specific date
POST /api/jobs/generate-instances-new
{
  "date": "2024-01-15",
  "testMode": false,
  "dryRun": false,
  "forceRegenerate": false,
  "maxTasks": 100
}

# GET version
GET /api/jobs/generate-instances-new?date=2024-01-15&testMode=true
```

### Update Statuses
```bash
# Update statuses for a specific date
POST /api/jobs/update-statuses-new
{
  "date": "2024-01-15",
  "testMode": false,
  "maxInstances": 1000
}

# GET version
GET /api/jobs/update-statuses-new?date=2024-01-15&testMode=true
```

## Code Usage

### Basic Engine Usage
```typescript
import { createTaskRecurrenceStatusEngine } from '@/lib/task-recurrence-status-engine'

// Create engine instance
const engine = await createTaskRecurrenceStatusEngine()

// Generate instances
const result = engine.generateInstancesForDate(masterTasks, '2024-01-15')

// Update statuses
const statusResults = engine.updateInstanceStatuses(instances, new Date())
```

### High-Level Generator Usage
```typescript
import { runNewDailyGeneration, runNewDailyStatusUpdate } from '@/lib/new-task-generator'

// Generate instances with full database integration
const generationResult = await runNewDailyGeneration('2024-01-15', {
  testMode: false,
  dryRun: false,
  forceRegenerate: false
})

// Update statuses with full database integration
const statusResult = await runNewDailyStatusUpdate('2024-01-15', {
  testMode: false
})
```

### Database Adapter Usage
```typescript
import { taskDatabaseAdapter } from '@/lib/task-database-adapter'

// Load active master tasks
const masterTasks = await taskDatabaseAdapter.loadActiveMasterTasks()

// Load instances for a date
const instances = await taskDatabaseAdapter.loadTaskInstancesForDate('2024-01-15')

// Save new instances
await taskDatabaseAdapter.saveTaskInstances(newInstances)

// Update instance statuses
await taskDatabaseAdapter.updateTaskInstanceStatuses(updates)
```

## Testing

### Run Test Suite
```bash
# Run comprehensive test suite
npx tsx scripts/test-recurrence-engine.ts
```

### Test Coverage
- ✅ All 26 frequency patterns
- ✅ Holiday date shifting
- ✅ Weekend handling
- ✅ Status transitions
- ✅ Lock timing
- ✅ Carry behavior
- ✅ Database integration
- ✅ API endpoints

## Migration

### Database Migration
The engine requires database schema updates. Run the migration:

```sql
-- Apply the complete recurrence engine migration
\i supabase/migrations/008_complete_recurrence_engine_support.sql
```

### Legacy Data Migration
The migration automatically:
- Converts single `frequency` values to `frequencies` arrays
- Updates timing values to new constraint
- Sets default due times based on timing
- Updates status values to new engine format
- Creates necessary indexes and constraints

## Configuration

### Environment Variables
```env
# Default business timezone
DEFAULT_BUSINESS_TIMEZONE=Australia/Sydney

# Database connection (Supabase)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key
```

### System Settings
The engine uses these system settings (stored in database):
- `recurrence_engine_version`: Engine version
- `default_business_timezone`: Business timezone
- `workday_start_time`: Default workday start
- `workday_end_time`: Default workday end
- `status_update_enabled`: Enable automatic status updates
- `instance_generation_enabled`: Enable automatic generation

## Performance

### Optimizations
- **Efficient Holiday Checking**: Pre-loaded holiday cache
- **Batch Operations**: Bulk database operations
- **Smart Indexing**: Optimized database indexes
- **Minimal Queries**: Reduced database round trips

### Scalability
- **Stateless Design**: No server-side state
- **Horizontal Scaling**: Can run on multiple instances
- **Database Optimization**: Efficient queries and indexes
- **Caching**: Holiday data cached in memory

## Monitoring

### Logging
The engine provides comprehensive logging:
- Instance generation results
- Status update results
- Error conditions
- Performance metrics

### Metrics
Track these key metrics:
- Instances generated per day
- Status updates per day
- Error rates
- Processing time

## Troubleshooting

### Common Issues

1. **No instances generated**
   - Check master task `publish_status = 'active'`
   - Verify `publish_delay` date
   - Check frequency configuration

2. **Wrong due dates**
   - Verify holiday data is loaded
   - Check timezone configuration
   - Validate frequency pattern logic

3. **Status not updating**
   - Check system time vs due time
   - Verify timezone settings
   - Check lock status

4. **Database errors**
   - Run migration script
   - Check column constraints
   - Verify data types

### Debug Mode
Enable debug logging:
```typescript
const generator = await createNewTaskGenerator('debug')
```

## Future Enhancements

### Planned Features
- **Custom Frequency Patterns**: User-defined patterns
- **Advanced Holiday Rules**: Regional holiday support
- **Notification Integration**: Automated alerts
- **Performance Dashboard**: Real-time monitoring
- **Bulk Operations**: Mass task management

### Extension Points
- **Custom Status Logic**: Pluggable status rules
- **External Integrations**: Third-party calendar sync
- **Advanced Reporting**: Detailed analytics
- **Mobile API**: Mobile app support

## Conclusion

The Task Recurrence & Status Engine provides a complete, deterministic solution for task management in the Pharmacy Intranet Portal. It handles all specified frequency patterns, integrates seamlessly with the existing database, and provides robust API access for external systems.

The implementation is production-ready, well-tested, and designed for scalability and maintainability.