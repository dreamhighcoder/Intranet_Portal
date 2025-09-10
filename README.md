# 🏥 Pharmacy Intranet Portal

A comprehensive Next.js-based intranet portal for pharmacy task management with role-based access control, automated task generation, and comprehensive reporting features.

## ⏰ **CRITICAL: AUSTRALIAN TIMEZONE REQUIREMENT**

**🇦🇺 ALL TIMES IN THIS PROJECT MUST BE AUSTRALIAN TIME (Sydney/Melbourne timezone)**

- **Current time references:** Always use Australian time (AEDT/AEST)
- **Task scheduling:** All due times and dates are in Australian timezone
- **Database times:** Stored and processed in Australian timezone
- **Local system time is IRRELEVANT** - only Australian time matters

This is a **MANDATORY** requirement for all development, analysis, and operations.

## 📋 Overview

This application allows pharmacists to track, manage, and complete daily tasks with:
- **Role-based Authentication** (Admin/Viewer roles)
- **Position-based Task Assignment** (Pharmacist Primary, Supporting, Assistants, etc.)
- **Advanced Task Recurrence Engine** with 36+ frequency patterns
- **Automated Task Generation** with complex recurrence patterns
- **Real-time Status Management** and audit logging
- **Public Holiday Integration** with automatic date shifting
- **Comprehensive Reporting** and analytics dashboard
- **System Settings Management** with database-backed configuration

## 🚀 Quick Setup

### Prerequisites
- Node.js 18+ and pnpm
- Supabase account with project created

### Installation Steps

1. **Clone and Install Dependencies:**
   ```bash
   git clone <repository-url>
   cd pharmacy-intranet-portal
   pnpm install
   ```

2. **Environment Configuration:**
   ```bash
   cp .env.template .env.local
   # Edit .env.local with your Supabase credentials:
   # NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   # NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   # SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   # CRON_API_KEY=your_cron_api_key_for_production
   ```

3. **Database Setup:**
   Run the following SQL scripts in your Supabase Dashboard (SQL Editor) **in order**:
   ```bash
   # 1. Core schema
   supabase/schema.sql
   
   # 2. Security policies
   supabase/rls-policies.sql
   
   # 3. Initial data
   supabase/seed-data.sql
   
   # 4. Verification (optional)
   supabase/verify-setup.sql
   ```

4. **Start Development Server:**
   ```bash
   pnpm run dev
   ```

5. **Access the Application:**
   - Navigate to `http://localhost:3000`
   - Login with Administrator credentials:
     - **Position**: Administrator
     - **Password**: `admin1234`

## 🏗️ Architecture

### Tech Stack
- **Framework:** Next.js 15.2.4 with React 19
- **Database:** Supabase (PostgreSQL) with Row Level Security
- **Authentication:** Supabase Auth with JWT tokens
- **Styling:** Tailwind CSS 4.1.9 with custom components
- **Forms:** React Hook Form + Zod validation
- **Charts:** Recharts for analytics
- **Package Manager:** pnpm

### Project Structure
```
├── app/                    # Next.js app router
│   ├── api/               # API routes
│   │   ├── auth/          # Authentication endpoints
│   │   ├── checklist/     # Task management
│   │   ├── jobs/          # Background job endpoints
│   │   ├── reports/       # Analytics and reporting
│   │   ├── admin/         # Admin-only endpoints
│   │   └── ...            # Other API endpoints
│   ├── admin/             # Admin-only pages
│   │   ├── settings/      # System settings management
│   │   ├── master-tasks/  # Task template management
│   │   ├── reports/       # Analytics dashboard
│   │   └── ...            # Other admin pages
│   ├── checklist/         # Task checklist pages
│   ├── login/             # Authentication pages
│   └── ...                # Other app pages
├── components/            # Reusable React components
│   ├── ui/               # UI primitives (buttons, forms, etc.)
│   ├── admin/            # Admin-specific components
│   ├── checklist/        # Task management components
│   └── ...               # Other components
├── lib/                  # Core business logic
│   ├── supabase.ts       # Database client configuration
│   ├── position-auth-context.tsx  # Authentication context
│   ├── api-client.ts     # API service layer
│   ├── new-recurrence-engine.ts        # Complete implementation (36 rules)
│   ├── new-task-generator.ts  # Task generation orchestration
│   ├── task-database-adapter.ts  # Database integration layer
│   ├── status-manager.ts # Task status automation
│   ├── system-settings.ts # System configuration management
│   └── ...               # Other utilities
├── supabase/             # Database schema & migrations
│   ├── schema.sql        # Core database schema
│   ├── rls-policies.sql  # Row Level Security policies
│   ├── seed-data.sql     # Initial data and test data
│   ├── verify-setup.sql  # Setup verification queries
│   └── migrations/       # Database migration files
├── scripts/              # Utility and maintenance scripts
│   ├── setup-database.ts # Database setup automation
│   ├── check-schema.ts   # Schema validation
│   └── ...               # Other utility scripts
└── types/                # TypeScript type definitions
```

## 🔧 Core Features

### Authentication & Authorization
- ✅ **Supabase Auth Integration** - Secure JWT-based authentication
- ✅ **Role-based Access Control** - Admin and Viewer roles
- ✅ **Position-based Permissions** - Access control by pharmacy position
- ✅ **Automatic Profile Creation** - User profiles created on first login
- ✅ **Auto-logout System** - Configurable inactivity timeout

### Task Management System
- ✅ **Master Task Templates** - Reusable task definitions with complex scheduling
- ✅ **Task Instance Generation** - Automatic creation of daily task instances
- ✅ **36+ Recurrence Patterns** - From simple daily to complex monthly patterns
- ✅ **Status Automation** - Automatic transitions (Pending → Overdue → Missed → Locked)
- ✅ **Carry Behavior** - Tasks can carry over multiple days based on frequency type
- ✅ **Due Date/Time Management** - Flexible scheduling with override capabilities
- ✅ **Task Activation System** - Manual and automatic task activation with publish delays

### Advanced Recurrence Engine (36 Frequency Types)

#### Basic Patterns
- **Once Off** - Single occurrence with admin-specified due date
- **Once Off Sticky** - Same as once off but remains visible after completion
- **Every Day** - Daily tasks excluding Sundays and public holidays

#### Weekly Patterns
- **Once Weekly** - Weekly tasks anchored to Mondays with holiday shifting
- **Specific Weekdays** - Monday through Saturday with holiday shifting
  - Monday, Tuesday, Wednesday, Thursday, Friday, Saturday

#### Monthly Patterns
- **Start of Every Month** - First business day of each month
- **Start of Specific Months** - First business day of specific months (Jan-Dec)
- **Once Monthly** - Monthly tasks with last Saturday due dates
- **End of Every Month** - Last Monday with sufficient workdays remaining
- **End of Specific Months** - Last Monday of specific months (Jan-Dec)

#### Key Features
- **Deterministic Logic** - Same inputs always produce same outputs
- **Holiday Awareness** - Automatic skipping or shifting based on pattern type
- **Business Day Logic** - Respects weekends and public holidays
- **Precise Timing** - Exact due times and status transition timing
- **Carry Logic** - Different carry behaviors per frequency type

### System Settings Management
- ✅ **Database-backed Configuration** - All settings stored in database
- ✅ **Real-time Application** - Settings applied immediately across system
- ✅ **Admin-only Access** - Secure settings management
- ✅ **Comprehensive Validation** - Input validation and error handling
- ✅ **Caching Strategy** - 5-minute cache for performance optimization

#### Available Settings
**Timezone & Regional Settings:**
- System Timezone (configurable, currently Australia/Sydney)
- Working Days (multi-select, affects task generation)

**Task Management:**
- New Task Hour (when tasks become "new")
- Missed Cutoff Time (when tasks become "missed")
- Generation Days Ahead/Behind (bulk generation ranges)
- Public Holiday Handling (enable/disable holiday substitution)

**Security & Sessions:**
- Auto Logout (enable/disable)
- Auto Logout Delay (1-1440 minutes)

### Admin Dashboard
- ✅ **KPI Metrics** - Real-time performance indicators
- ✅ **Task Completion Analytics** - Completion rates by position and time
- ✅ **User & Position Management** - Assign users to pharmacy positions
- ✅ **Master Task Editor** - Create and modify task templates
- ✅ **Background Job Monitoring** - Track automated processes
- ✅ **Audit Trail Access** - Complete history of all actions
- ✅ **System Settings Panel** - Configure system-wide settings

### Reporting & Analytics
- ✅ **Completion Rate Reports** - Track performance over time
- ✅ **Missed Task Analysis** - Identify problem areas
- ✅ **Position Performance** - Compare different roles
- ✅ **Trend Analysis** - Historical performance data
- ✅ **Export Capabilities** - Data export for external analysis

## 📊 Database Schema

### Core Tables

#### Positions
- Defines pharmacy roles (Pharmacist Primary, Supporting, Assistants, etc.)
- Links to user profiles for access control
- Display order for UI presentation

#### User Profiles
- User information and role assignments
- Automatic creation on first login
- Position-based access control

#### Master Tasks
- Recurring task templates with complex scheduling rules
- Support for 36+ frequency patterns
- Responsibility and category assignments
- Timing and due date specifications
- Publish status and activation delays

#### Task Instances
- Individual task occurrences generated from master tasks
- Status tracking (Pending, Overdue, Missed, Locked, Completed)
- Completion tracking with user and timestamp
- Override capabilities for due dates/times
- Carry instance tracking

#### Public Holidays
- Holiday calendar for automatic date shifting
- Supports different holiday handling per frequency type
- Integration with recurrence engine

#### System Settings
- Database-backed configuration storage
- Cached for performance (5-minute TTL)
- Comprehensive validation and type conversion

#### Audit Log
- Complete trail of all task actions
- User tracking for all changes
- Timestamp and action type logging
- Metadata storage for detailed context

### Row Level Security (RLS)
- **Admins:** Full access to all data across all positions
- **Viewers:** Access only to tasks for their assigned position
- **Users:** Can read own profile and update task completions
- **Position-based Filtering:** Automatic data filtering by user position

## 🚀 Production Operations

### Database Management
```bash
# Set up database schema and initial data
pnpm run setup-db

# Check database schema status
pnpm run check-schema

# Run database migrations
pnpm run run-migration
```

### Automated Background Jobs

#### Development Environment
```bash
# Generate daily task instances
pnpm run generate-tasks

# Update task statuses (Overdue/Missed/Locked)
pnpm run update-statuses

# Bulk operations
pnpm run bulk-generate-and-update
pnpm run bulk-update-statuses
```

#### Production Environment
```bash
# Production task generation (requires CRON_API_KEY)
pnpm run generate-tasks-prod

# Production status updates (requires CRON_API_KEY)
pnpm run update-statuses-prod
```

#### Scheduling Recommendations
- **Task Activation:** Run daily at 12:01 AM
- **Task Generation:** Run daily at 12:05 AM
- **Status Updates:** Run every hour during business hours
- **Cleanup Jobs:** Run weekly to archive old completed tasks

### Cron Job Setup

Set up daily cron jobs for production:

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

3. **Status Updates** (runs hourly):
   ```bash
   curl -X POST https://your-domain/api/jobs/update-statuses \
     -H "Authorization: Bearer YOUR_CRON_API_KEY"
   ```

## 🔍 API Endpoints

### Authentication
- `GET/POST /api/auth/*` - Supabase Auth integration
- `GET /api/auth/user` - Current user information

### Core Data Management
- `GET/POST /api/positions` - Position management
- `GET/POST/PUT/DELETE /api/master-tasks` - Task template management
- `GET/POST/PUT /api/task-instances` - Individual task management
- `GET/POST /api/user-profiles` - User profile management

### Task Operations
- `GET /api/checklist` - Get tasks for role and date
- `POST /api/checklist/complete` - Mark task as completed
- `GET /api/calendar` - Calendar view of tasks

### Background Jobs
- `POST /api/jobs/activate-tasks` - Activate tasks past their publish delay
- `POST /api/jobs/generate-instances` - Generate daily task instances
- `POST /api/jobs/update-statuses` - Update task statuses

### System Management
- `GET/PUT /api/admin/settings` - System settings management
- `GET /api/holidays` - Public holiday management
- `POST /api/admin/bulk-generate` - Bulk task generation

### Reporting & Analytics
- `GET /api/reports/kpis` - Key performance indicators
- `GET /api/reports/completion-rates` - Task completion analytics
- `GET /api/audit-log` - Audit trail access
- `GET /api/dashboard` - Admin dashboard data

### Testing & Development
- `POST /api/test/task-activation` - Comprehensive task activation testing
- `GET /api/health` - System health checks

## 🛠️ Development Guide

### Adding New Recurrence Patterns
1. **Update Engine Logic:**
   ```typescript
   // In lib/new-recurrence-engine.ts
   // Add new frequency type to FrequencyType enum
   // Implement generation logic in shouldTaskAppearOnDate()
   // Add due date calculation in calculateDueDate()
   // Define carry behavior in getCarryUntilDate()
   ```

2. **Update UI Components:**
   ```typescript
   // In components/admin/TaskFormNew.tsx
   // Add new frequency option to form
   // Update validation schema if needed
   ```

3. **Test Implementation:**
   ```bash
   # Test new patterns using the test endpoint
   POST /api/test/task-activation
   {
     "action": "full_test",
     "frequency": "your_new_frequency",
     "testDate": "2024-01-15"
   }
   ```

### Database Migrations
1. **Create Migration File:**
   ```sql
   -- In supabase/migrations/XXX_description.sql
   -- Add your schema changes
   ```

2. **Run Migration:**
   ```bash
   pnpm run run-migration
   ```

3. **Update RLS Policies:**
   ```sql
   -- Update supabase/rls-policies.sql if needed
   ```

### Adding New API Endpoints
1. **Create Route Handler:**
   ```typescript
   // In app/api/your-endpoint/route.ts
   import { authenticatedGet } from '@/lib/api-client'
   
   export async function GET(request: Request) {
     // Implementation
   }
   ```

2. **Add Authentication:**
   ```typescript
   import { getUser } from '@/lib/auth-server'
   
   const user = await getUser()
   if (!user) {
     return new Response('Unauthorized', { status: 401 })
   }
   ```

3. **Update Client:**
   ```typescript
   // In lib/api-client.ts or component
   const data = await authenticatedGet('/api/your-endpoint')
   ```

### Adding New System Settings
1. **Update Database Schema:**
   ```sql
   -- Add new setting to system_settings table
   INSERT INTO system_settings (key, value, data_type, description)
   VALUES ('new_setting', 'default_value', 'string', 'Description');
   ```

2. **Update Settings Library:**
   ```typescript
   // In lib/system-settings.ts
   // Add new setting to SystemSettings interface
   // Update getSystemSettings() to include new setting
   // Add validation in updateSystemSettings()
   ```

3. **Update Frontend:**
   ```typescript
   // In app/admin/settings/page.tsx
   // Add new form field for the setting
   // Update form validation schema
   ```

## 🔒 Security Features

### Authentication Security
- **JWT Tokens** - Secure session management via Supabase
- **Token Refresh** - Automatic token renewal
- **Session Validation** - Server-side authentication verification
- **Secure Logout** - Complete session cleanup
- **Auto-logout Protection** - Configurable inactivity timeout

### Database Security
- **Row Level Security (RLS)** - Database-level access control
- **Position-based Filtering** - Automatic data isolation
- **SQL Injection Protection** - Parameterized queries
- **Service Role Protection** - Separate keys for admin operations

### API Security
- **Route Protection** - Server-side authentication checks
- **Role Validation** - Admin-only endpoint protection
- **CORS Configuration** - Proper cross-origin settings
- **Rate Limiting** - Built-in Next.js protection
- **CRON API Key** - Secure background job execution

### Data Security
- **Audit Logging** - Complete trail of all changes
- **Data Validation** - Zod schema validation
- **Input Sanitization** - XSS protection
- **Secure Headers** - Security-focused HTTP headers

## 🧪 Testing

### Manual Testing
1. **Settings Management:**
   - Navigate to `/admin/settings`
   - Modify each setting type and save
   - Refresh page to verify persistence
   - Check that changes are applied system-wide

2. **Task Activation:**
   ```bash
   # Test task activation system
   POST /api/test/task-activation
   {
     "action": "full_test",
     "frequency": "every_day",
     "testDate": "2024-01-15"
   }
   ```

3. **Background Jobs:**
   ```bash
   # Test task generation
   curl -X GET "http://localhost:3000/api/jobs/generate-instances?mode=daily"
   
   # Test status updates
   curl -X GET "http://localhost:3000/api/jobs/update-statuses"
   ```

### Automated Testing Scripts
- **`scripts/verify-settings-integration.ts`** - Settings integration verification
- **`scripts/test-system-settings.ts`** - CRUD operations testing
- **`scripts/check-schema.ts`** - Database schema validation

## 🚨 Troubleshooting

### Common Issues

#### Database Connection Issues
```bash
# Check database schema
pnpm run check-schema

# Verify Supabase connection
# Check .env.local file for correct credentials
```

#### Task Generation Problems
```bash
# Check task activation
POST /api/test/task-activation
{
  "action": "cleanup_test_data"
}

# Verify holiday data
GET /api/holidays
```

#### Settings Not Persisting
```bash
# Clear settings cache
# Check admin permissions
# Verify database connection
```

### Audit Log Constraint Issues
If you encounter audit log constraint errors:
```sql
-- Run the fix script in Supabase SQL Editor
-- File: supabase/fix-audit-constraint-manual.sql
```

## 📈 Performance Optimization

### Database Performance
- **Proper Indexing** - Optimized queries for task instances and audit logs
- **RLS Optimization** - Efficient row-level security policies
- **Connection Pooling** - Supabase handles connection management

### Application Performance
- **Settings Caching** - 5-minute cache for system settings
- **API Response Caching** - Strategic caching for frequently accessed data
- **Lazy Loading** - Components loaded on demand
- **Optimized Queries** - Minimal database round trips

### Background Job Performance
- **Batch Processing** - Bulk operations for task generation
- **Error Handling** - Graceful failure recovery
- **Monitoring** - Comprehensive logging for job execution

## 🔄 Maintenance

### Regular Maintenance Tasks
1. **Weekly:**
   - Review audit logs for unusual activity
   - Check background job execution logs
   - Monitor database performance metrics

2. **Monthly:**
   - Archive old completed tasks
   - Review and update public holidays
   - Analyze task completion trends

3. **Quarterly:**
   - Review and update system settings
   - Audit user permissions and positions
   - Performance optimization review

### Database Maintenance
```bash
# Clear old audit logs (optional)
pnpm run clear-audit-log

# Update database schema
pnpm run run-migration

# Verify system integrity
pnpm run check-schema
```

## 📚 Additional Resources

### Key Files for Understanding the System
- `lib/new-recurrence-engine.ts` - Core frequency logic (36 patterns)
- `lib/new-task-generator.ts` - Task generation orchestration
- `lib/system-settings.ts` - System configuration management
- `lib/position-auth-context.tsx` - Authentication and authorization
- `supabase/schema.sql` - Complete database schema

### Environment Variables
```bash
# Required for basic operation
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Required for production cron jobs
CRON_API_KEY=your_secure_cron_api_key
NEXT_PUBLIC_SITE_URL=https://your-production-domain.com
```

## 🎯 Conclusion

The Pharmacy Intranet Portal is a comprehensive task management system designed specifically for pharmacy operations. It provides:

- **Robust Task Management** with 36+ frequency patterns
- **Secure Authentication** with role-based access control
- **Automated Operations** with background job processing
- **Comprehensive Reporting** with real-time analytics
- **Flexible Configuration** with database-backed settings
- **Production-Ready** with proper security and performance optimization

The system is designed to handle complex pharmacy workflows while maintaining simplicity for end users and providing powerful administrative capabilities for system managers.

For support or questions, refer to the API documentation, test endpoints, and comprehensive audit logging system built into the application.