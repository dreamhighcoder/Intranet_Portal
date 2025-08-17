# Master Checklist Schema Documentation

## Overview

This document describes the database schema changes and frequency rules JSON schema for the Master Checklist system in the Pharmacy Intranet Portal.

## Database Changes

### Updated `master_tasks` Table

The existing `master_tasks` table has been extended with new fields to support the enhanced checklist functionality:

| Column | Type | Description | Default |
|--------|------|-------------|---------|
| `responsibility` | `TEXT[]` | Array of role names responsible for this task | `{}` |
| `categories` | `TEXT[]` | Array of category tags for classification | `{}` |
| `frequency_rules` | `JSONB` | Complex frequency configuration (see schema below) | `{}` |
| `due_date` | `DATE` | Specific due date for once-off tasks | `NULL` |
| `due_time` | `TIME` | Time when task should be completed | `NULL` |
| `created_by` | `UUID` | User who created the task | `NULL` |
| `updated_by` | `UUID` | User who last updated the task | `NULL` |
| `publish_delay` | `DATE` | Date when task becomes visible (delayed publishing) | `NULL` |

**Note**: The migration safely renames `default_due_time` to `due_time` and `publish_delay_date` to `publish_delay` for consistency.

### New `checklist_instances` Table

A new table tracks individual occurrences of master tasks:

| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| `id` | `UUID` | Primary key | `PRIMARY KEY` |
| `master_task_id` | `UUID` | Reference to master task | `NOT NULL, FK` |
| `date` | `DATE` | Instance date | `NOT NULL` |
| `role` | `TEXT` | Role responsible for this instance | `NOT NULL` |
| `status` | `TEXT` | Instance status | `CHECK (status IN (...))` |
| `completed_by` | `UUID` | User who completed the task | `FK to auth.users` |
| `completed_at` | `TIMESTAMP` | When task was completed | `NULL` |
| `payload` | `JSONB` | Additional data/metadata | `DEFAULT '{}'` |
| `notes` | `TEXT` | User notes | `NULL` |
| `created_at` | `TIMESTAMP` | Creation timestamp | `DEFAULT NOW()` |
| `updated_at` | `TIMESTAMP` | Last update timestamp | `DEFAULT NOW()` |

**Unique Constraint**: `(master_task_id, date, role)` ensures no duplicate instances for the same task, date, and role combination.

## Frequency Rules JSON Schema

The `frequency_rules` JSONB field contains a structured configuration that defines how and when tasks recur. This replaces the previous simple `frequency` enum and related fields.

### Base Frequency Rule

All frequency rules extend this base interface:

```typescript
interface BaseFrequencyRule {
  type: FrequencyType
  business_days_only?: boolean      // Skip weekends
  exclude_holidays?: boolean       // Skip public holidays
  start_date?: string              // ISO date when rule becomes active
  end_date?: string                // ISO date when rule expires
}
```

### Supported Frequency Types

#### 1. Daily (`daily`)
```json
{
  "type": "daily",
  "every_n_days": 1,
  "business_days_only": true
}
```

#### 2. Weekly (`weekly`)
```json
{
  "type": "weekly",
  "every_n_weeks": 2,
  "start_day": 1,
  "business_days_only": true
}
```

#### 3. Specific Weekdays (`specific_weekdays`)
```json
{
  "type": "specific_weekdays",
  "weekdays": [1, 3, 5],
  "every_n_weeks": 1,
  "business_days_only": true
}
```

#### 4. Start of Month (`start_of_month`)
```json
{
  "type": "start_of_month",
  "every_n_months": 3,
  "months": [1, 4, 7, 10],
  "day_offset": 0,
  "business_days_only": true
}
```

#### 5. Once-off (`once_off`)
```json
{
  "type": "once_off",
  "due_date": "2024-12-31"
}
```

### Advanced Features

- **Business Days Only**: Automatically skips weekends and public holidays
- **Month Filtering**: Limit tasks to specific months (e.g., quarterly reviews)
- **Day Offsets**: Start from 1st, 2nd, 3rd day of month, or end of month
- **Flexible Intervals**: Every N days/weeks/months
- **Date Ranges**: Start and end dates for temporary rules

## Database Design Decisions

### 1. Backward Compatibility

- **Safe Migration**: Uses `ALTER TABLE ADD COLUMN IF NOT EXISTS` to avoid conflicts
- **Column Renaming**: Safely renames existing columns for consistency
- **No Data Loss**: All existing data is preserved

### 2. Performance Optimization

- **GIN Indexes**: Array and JSONB columns use GIN indexes for fast queries
- **Composite Indexes**: Multi-column indexes for common query patterns
- **Role-based Access**: Indexes support efficient role-based filtering

### 3. Data Integrity

- **Foreign Keys**: Proper referential integrity with cascade deletes
- **Check Constraints**: Status values are validated at database level
- **Unique Constraints**: Prevents duplicate instances
- **Triggers**: Automatic timestamp updates and audit trail

### 4. Security

- **Row Level Security (RLS)**: Users only see tasks for their assigned roles
- **Role-based Policies**: Different access levels for admins vs. viewers
- **Audit Trail**: Complete logging of all changes

## Example Usage

### Creating a Daily Safety Check

```sql
INSERT INTO master_tasks (
    title, 
    description, 
    responsibility, 
    categories, 
    frequency_rules,
    timing,
    due_time,
    publish_status
) VALUES (
    'Daily Safety Check',
    'Perform daily safety inspection of pharmacy area',
    ARRAY['pharmacist-primary', 'pharmacy-assistants'],
    ARRAY['safety', 'compliance'],
    '{"type": "daily", "every_n_days": 1, "business_days_only": true}',
    'morning',
    '09:00:00',
    'active'
);
```

### Creating a Quarterly Compliance Review

```sql
INSERT INTO master_tasks (
    title, 
    description, 
    responsibility, 
    categories, 
    frequency_rules,
    timing,
    due_time,
    publish_status
) VALUES (
    'Quarterly Compliance Review',
    'Review compliance documentation and update records',
    ARRAY['pharmacist-primary', 'operational-managerial'],
    ARRAY['compliance', 'documentation'],
    '{"type": "start_of_month", "months": [1, 4, 7, 10], "business_days_only": true}',
    'morning',
    '10:00:00',
    'active'
);
```

## Migration Notes

1. **Safe to Run Multiple Times**: The migration uses `IF NOT EXISTS` checks
2. **No Downtime**: Adds columns without locking the table
3. **Rollback Support**: Can be reversed by dropping new columns
4. **Verification**: Includes comprehensive verification queries

## Next Steps

After running the migration:

1. Update TypeScript types in `types/checklist.ts`
2. Modify the recurrence engine to use the new JSONB frequency rules
3. Update UI components to handle the new fields
4. Test with the provided example data
5. Verify RLS policies are working correctly

## Performance Considerations

- **GIN Indexes**: Essential for array and JSONB queries
- **Composite Indexes**: Optimize common filtering patterns
- **Query Planning**: Monitor query performance with `EXPLAIN ANALYZE`
- **Partitioning**: Consider table partitioning for large datasets (future enhancement)
