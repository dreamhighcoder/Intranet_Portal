# Daily Checklist Generation Runbook
## Pharmacy Intranet Portal - Task Instance Generator & Status Manager

### Overview
This runbook covers the operational procedures for the automated daily checklist generation system, including scheduling, safety measures, testing, and troubleshooting.

### System Components

#### 1. Task Instance Generator (`lib/task-instance-generator.ts`)
- **Purpose**: Generates checklist instances for a specific date based on master tasks and recurrence rules
- **Key Features**: 
  - Idempotent operation (safe to run multiple times)
  - Test mode and dry run capabilities
  - Bulk generation for date ranges
  - Integration with recurrence engine and public holidays

#### 2. Status Manager (`lib/status-manager.ts`)
- **Purpose**: Updates instance statuses based on due times and business rules
- **Key Features**:
  - Automatic status transitions (pending → overdue → missed)
  - Business day logic and Saturday cutoffs for week/month rules
  - Configurable transition rules
  - Bulk status updates for date ranges

#### 3. Supabase Edge Function (`supabase/functions/generate_daily_checklists/index.ts`)
- **Purpose**: Serverless function for scheduled execution
- **Key Features**:
  - Environment-based configuration
  - Comprehensive logging and error handling
  - Test mode and dry run support
  - Manual invocation via API

### Scheduling Options

#### Option 1: Supabase Scheduled Functions (Recommended)
```bash
# Deploy the function
supabase functions deploy generate_daily_checklists

# Schedule to run daily at 6:00 AM
supabase functions schedule generate_daily_checklists "0 6 * * *"

# Schedule to run every 4 hours during business hours
supabase functions schedule generate_daily_checklists "0 6,10,14,18 * * 1-5"

# Schedule status updates every 30 minutes during business hours
supabase functions schedule generate_daily_checklists "*/30 8-18 * * 1-5"
```

#### Option 2: GitHub Actions (Alternative)
```yaml
# .github/workflows/daily-checklists.yml
name: Daily Checklist Generation
on:
  schedule:
    - cron: '0 6 * * *'  # Daily at 6:00 AM UTC
  workflow_dispatch:  # Manual trigger

jobs:
  generate-checklists:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run generate-daily-checklists
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
```

#### Option 3: Cron Job on Server
```bash
# Add to crontab
0 6 * * * /usr/bin/node /path/to/project/scripts/generate-daily-checklists.js

# Or using PM2
pm2 start scripts/generate-daily-checklists.js --name "daily-checklists" --cron "0 6 * * *"
```

### Safety Measures

#### 1. Idempotency
- **Principle**: Running the generator multiple times for the same date is safe
- **Implementation**: 
  - Checks for existing instances before creation
  - Skips generation if all tasks already have instances
  - Option to force regeneration if needed

#### 2. Test Mode
- **Purpose**: Validate logic without affecting production data
- **Usage**: Set `testMode: true` in function parameters
- **Behavior**: 
  - Logs what would happen
  - No database changes
  - Full validation of business logic

#### 3. Dry Run Mode
- **Purpose**: Preview changes without committing
- **Usage**: Set `dryRun: true` in function parameters
- **Behavior**:
  - Shows what would be generated/updated
  - No database changes
  - Useful for validation and testing

#### 4. Force Regeneration
- **Purpose**: Override existing instances
- **Usage**: Set `forceRegenerate: true` in function parameters
- **Safety**: Only available when not in test mode
- **Warning**: Will delete existing instances for the date

#### 5. Rate Limiting
- **Implementation**: `maxTasks` and `maxInstances` parameters
- **Purpose**: Prevent overwhelming the system
- **Default**: No limits (process all tasks/instances)

### Testing Procedures

#### 1. Unit Testing
```bash
# Run all tests
npm test

# Run specific test suites
npm test -- --testNamePattern="RecurrenceEngine"
npm test -- --testNamePattern="StatusManager"
npm test -- --testNamePattern="TaskInstanceGenerator"

# Run with coverage
npm run test:coverage
```

#### 2. Integration Testing
```bash
# Test with test database
npm run test:integration

# Test specific components
npm run test:db
npm run test:recurrence
```

#### 3. Manual Testing
```bash
# Test generation for today (dry run)
curl -X POST https://your-project.supabase.co/functions/v1/generate_daily_checklists \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"dryRun": true, "testMode": true}'

# Test generation for specific date
curl -X POST https://your-project.supabase.co/functions/v1/generate_daily_checklists \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"date": "2024-01-15", "dryRun": true}'

# Test with force regeneration
curl -X POST https://your-project.supabase.co/functions/v1/generate_daily_checklists \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"forceRegenerate": true, "dryRun": true}'
```

### Operational Procedures

#### 1. Daily Operations
```bash
# Check function logs
supabase functions logs generate_daily_checklists

# Monitor execution
supabase functions logs generate_daily_checklists --follow

# Check function status
supabase functions list
```

#### 2. Manual Execution
```bash
# Generate for today
curl -X POST https://your-project.supabase.co/functions/v1/generate_daily_checklists \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'

# Generate for specific date
curl -X POST https://your-project.supabase.co/functions/v1/generate_daily_checklists \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"date": "2024-01-15"}'

# Generate for date range (using bulk functions)
npm run generate:range -- --start-date=2024-01-01 --end-date=2024-01-31
```

#### 3. Emergency Procedures
```bash
# Stop scheduled execution
supabase functions unschedule generate_daily_checklists

# Disable function
supabase functions delete generate_daily_checklists

# Rollback to previous version
supabase functions deploy generate_daily_checklists --version=previous
```

### Monitoring and Alerting

#### 1. Log Monitoring
- **Function Logs**: Check Supabase dashboard for function execution logs
- **Database Logs**: Monitor for unusual activity in `audit_log` table
- **Application Logs**: Check application logs for errors

#### 2. Key Metrics
- **Generation Success Rate**: Should be >95%
- **Execution Time**: Should be <30 seconds for typical loads
- **Error Rate**: Should be <1%
- **Instance Creation Rate**: Should match expected task count

#### 3. Alerting Setup
```bash
# Set up monitoring for function failures
# Configure alerts for:
# - Function execution failures
# - High error rates
# - Long execution times
# - Database connection issues
```

### Troubleshooting

#### 1. Common Issues

**Issue**: Function times out
- **Cause**: Large number of tasks or slow database queries
- **Solution**: Increase function timeout or add `maxTasks` limit

**Issue**: Duplicate instances created
- **Cause**: Function run multiple times or race conditions
- **Solution**: Check idempotency logic, verify unique constraints

**Issue**: Status updates not working
- **Cause**: Missing master task relationships or invalid data
- **Solution**: Check database integrity, verify foreign key constraints

**Issue**: Public holidays not respected
- **Cause**: Missing holiday data or incorrect date handling
- **Solution**: Verify holiday data, check date parsing logic

#### 2. Debug Commands
```bash
# Check function configuration
supabase functions config list generate_daily_checklists

# View function code
supabase functions list

# Test function locally
supabase functions serve generate_daily_checklists --env-file .env.local

# Check database state
psql -h your-db-host -U postgres -d postgres -c "SELECT COUNT(*) FROM checklist_instances WHERE date = CURRENT_DATE;"
```

#### 3. Recovery Procedures
```bash
# Reset function state
supabase functions redeploy generate_daily_checklists

# Clear function logs
supabase functions logs clear generate_daily_checklists

# Restart function
supabase functions restart generate_daily_checklists
```

### Performance Optimization

#### 1. Database Optimization
```sql
-- Ensure proper indexes exist
CREATE INDEX IF NOT EXISTS idx_checklist_instances_date ON checklist_instances(date);
CREATE INDEX IF NOT EXISTS idx_checklist_instances_master_task_date ON checklist_instances(master_task_id, date);
CREATE INDEX IF NOT EXISTS idx_master_tasks_publish_status ON master_tasks(publish_status);

-- Monitor query performance
EXPLAIN ANALYZE SELECT * FROM master_tasks WHERE publish_status = 'active';
```

#### 2. Function Optimization
- **Batch Processing**: Process tasks in batches of 100-500
- **Parallel Processing**: Use Promise.all for independent operations
- **Connection Pooling**: Reuse database connections
- **Caching**: Cache frequently accessed data (holidays, master tasks)

#### 3. Monitoring Performance
```bash
# Check function execution times
supabase functions logs generate_daily_checklists | grep "execution time"

# Monitor database performance
psql -h your-db-host -U postgres -d postgres -c "SELECT query, mean_time, calls FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"
```

### Security Considerations

#### 1. Access Control
- **Service Role Key**: Use service role key for function execution
- **RLS Policies**: Ensure proper Row Level Security policies
- **Function Permissions**: Limit function access to necessary operations

#### 2. Data Validation
- **Input Validation**: Validate all function parameters
- **SQL Injection**: Use parameterized queries (already implemented)
- **Data Sanitization**: Sanitize all input data

#### 3. Audit Trail
- **Logging**: Comprehensive logging of all operations
- **Audit Table**: Track all changes in `audit_log` table
- **Monitoring**: Monitor for suspicious activity

### Backup and Recovery

#### 1. Data Backup
```bash
# Backup checklist instances
pg_dump -h your-db-host -U postgres -d postgres -t checklist_instances > checklist_instances_backup.sql

# Backup master tasks
pg_dump -h your-db-host -U postgres -d postgres -t master_tasks > master_tasks_backup.sql
```

#### 2. Function Backup
```bash
# Export function code
supabase functions list
# Manually save function code to version control

# Backup function configuration
supabase functions config list generate_daily_checklists > function_config_backup.txt
```

#### 3. Recovery Procedures
```bash
# Restore function
supabase functions deploy generate_daily_checklists

# Restore data (if needed)
psql -h your-db-host -U postgres -d postgres < checklist_instances_backup.sql

# Verify recovery
curl -X POST https://your-project.supabase.co/functions/v1/generate_daily_checklists \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"dryRun": true, "testMode": true}'
```

### Maintenance Schedule

#### 1. Daily
- Check function execution logs
- Monitor error rates
- Verify instance generation counts

#### 2. Weekly
- Review performance metrics
- Check for data anomalies
- Verify holiday data accuracy

#### 3. Monthly
- Review and update transition rules
- Analyze performance trends
- Update documentation

#### 4. Quarterly
- Full system health check
- Performance optimization review
- Security audit

### Contact Information

- **System Administrator**: [Your Name] - [email@example.com]
- **Database Administrator**: [DBA Name] - [dba@example.com]
- **Emergency Contact**: [Emergency Contact] - [emergency@example.com]

### Version History

- **v1.0.0** (2024-01-XX): Initial implementation
- **v1.1.0** (2024-XX-XX): Added status manager
- **v1.2.0** (2024-XX-XX): Added Supabase Edge function

---

**Last Updated**: [Date]
**Next Review**: [Date + 3 months]
**Document Owner**: [Your Name]
