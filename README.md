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
- **Advanced Task Recurrence Engine** with 26+ frequency patterns
- **Automated Task Generation** with complex recurrence patterns
- **Real-time Status Management** and audit logging
- **Public Holiday Integration** with automatic date shifting
- **Comprehensive Reporting** and analytics dashboard

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
│   │   └── ...            # Other API endpoints
│   ├── admin/             # Admin-only pages
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

### Task Management System
- ✅ **Master Task Templates** - Reusable task definitions with complex scheduling
- ✅ **Task Instance Generation** - Automatic creation of daily task instances
- ✅ **26+ Recurrence Patterns** - From simple daily to complex monthly patterns
- ✅ **Status Automation** - Automatic transitions (Pending → Overdue → Missed → Locked)
- ✅ **Carry Behavior** - Tasks can carry over multiple days based on frequency type
- ✅ **Due Date/Time Management** - Flexible scheduling with override capabilities

### Advanced Recurrence Engine
The system supports sophisticated scheduling patterns:

#### Basic Patterns
- **Once Off** - Single occurrence with admin-specified due date
- **Every Day** - Daily tasks excluding Sundays and public holidays
- **Once Weekly** - Weekly tasks anchored to specific days

#### Advanced Patterns
- **Specific Weekdays** - Monday through Saturday with holiday shifting
- **Monthly Patterns** - Start/end of month with business day logic
- **Quarterly/Yearly** - Advanced business scheduling
- **Holiday Integration** - Automatic date shifting for public holidays

#### Key Features
- **Deterministic Logic** - Same inputs always produce same outputs
- **Holiday Awareness** - Automatic skipping or shifting based on pattern type
- **Business Day Logic** - Respects weekends and public holidays
- **Precise Timing** - Exact due times and status transition timing
- **Carry Logic** - Different carry behaviors per frequency type

### Admin Dashboard
- ✅ **KPI Metrics** - Real-time performance indicators
- ✅ **Task Completion Analytics** - Completion rates by position and time
- ✅ **User & Position Management** - Assign users to pharmacy positions
- ✅ **Master Task Editor** - Create and modify task templates
- ✅ **Background Job Monitoring** - Track automated processes
- ✅ **Audit Trail Access** - Complete history of all actions

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

#### User Profiles
- User information and role assignments
- Automatic creation on first login
- Position-based access control

#### Master Tasks
- Recurring task templates with complex scheduling rules
- Support for 26+ frequency patterns
- Responsibility and category assignments
- Timing and due date specifications

#### Task Instances
- Individual task occurrences generated from master tasks
- Status tracking (Pending, Overdue, Missed, Locked, Completed)
- Completion tracking with user and timestamp
- Override capabilities for due dates/times

#### Public Holidays
- Holiday calendar for automatic date shifting
- Supports different holiday handling per frequency type
- Integration with recurrence engine

#### Audit Log
- Complete trail of all task actions
- User tracking for all changes
- Timestamp and action type logging

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

# New recurrence engine endpoints
pnpm run generate-tasks-new
pnpm run update-statuses-new
```

#### Production Environment
```bash
# Production task generation (requires CRON_API_KEY)
pnpm run generate-tasks-prod

# Production status updates (requires CRON_API_KEY)
pnpm run update-statuses-prod
```

#### Scheduling Recommendations
- **Task Generation:** Run daily at 12:01 AM
- **Status Updates:** Run every hour during business hours
- **Cleanup Jobs:** Run weekly to archive old completed tasks

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
- `GET /api/jobs/generate-instances` - Generate daily task instances
- `GET /api/jobs/update-statuses` - Update task statuses
- `GET /api/jobs/generate-instances-new` - New recurrence engine generation
- `GET /api/jobs/update-statuses-new` - New recurrence engine status updates

### Reporting & Analytics
- `GET /api/reports/kpis` - Key performance indicators
- `GET /api/reports/completion-rates` - Task completion analytics
- `GET /api/audit-log` - Audit trail access
- `GET /api/dashboard` - Admin dashboard data

### System Management
- `GET /api/holidays` - Public holiday management
- `GET /api/settings` - System configuration

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
   # Test new patterns using the new recurrence engine
   # Use the new-recurrence-engine.ts for proper implementation
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

## 🔒 Security Features

### Authentication Security
- **JWT Tokens** - Secure session management via Supabase
- **Token Refresh** - Automatic token renewal
- **Session Validation** - Server-side authentication verification
- **Secure Logout** - Complete session cleanup

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

### Data Security
- **Audit Logging** - Complete trail of all changes
- **Data Validation** - Zod schema validation
- **Input Sanitization** - XSS protection
- **Secure Headers** - Security-focused HTTP headers

## 🆘 Troubleshooting

### Common Issues

#### Authentication Problems
**"Error fetching position" in console:**
- Verify user profiles have valid position_id values
- Check RLS policies are applied correctly
- Ensure user exists in Supabase Auth Dashboard

**Login failures:**
- Verify environment variables in `.env.local`
- Check Supabase project URL and keys
- Confirm user exists with correct position assignment

#### Task Generation Issues
**No tasks appearing:**
- Check master tasks have valid position assignments
- Verify public holidays table is populated
- Ensure master tasks are marked as 'active'
- Check publish_at dates are not in the future

**Recurrence engine errors:**
- Run schema validation: `pnpm run check-schema`
- Check migration status: `pnpm run run-migration`
- Verify frequencies array format in master tasks

#### Database Issues
**Schema errors:**
- Run: `pnpm run check-schema` to identify issues
- Apply missing migrations from `supabase/migrations/`
- Verify RLS policies are active

**Performance issues:**
- Check database indexes on frequently queried columns
- Monitor Supabase dashboard for slow queries
- Consider archiving old completed tasks

### Debug Mode
The application includes comprehensive logging:
- **Browser Console:** Client-side errors and API responses
- **Server Logs:** API endpoint errors and database issues
- **Supabase Logs:** Database queries and RLS policy violations

### Getting Help
1. **Check Browser Console** - Detailed error messages with context
2. **Review Server Logs** - API endpoint and database errors
3. **Validate Database Schema** - Use `pnpm run check-schema`
4. **Test API Endpoints** - Use browser dev tools Network tab
5. **Check Supabase Dashboard** - Database logs and auth issues

## 🔄 Maintenance

### Regular Tasks
- **Weekly:** Review missed tasks and completion rates
- **Monthly:** Archive old completed tasks
- **Quarterly:** Review and update master task templates
- **Annually:** Update public holidays calendar

### Performance Monitoring
- Monitor Supabase dashboard for query performance
- Track API response times
- Review task completion metrics
- Monitor background job execution

### Backup Strategy
- Supabase provides automatic backups
- Export critical configuration data regularly
- Document any custom modifications
- Maintain environment variable backups

## 📄 License

This project is private and confidential. All rights reserved.

---

## 🎯 Admin Access Guide

### First-Time Setup
1. **Start Application:** `pnpm run dev`
2. **Navigate to:** `http://localhost:3000`
3. **Login Credentials:**
   - Position: **Administrator**
   - Password: **admin1234**

### Available Admin Features
- **Dashboard:** Real-time KPIs and performance metrics
- **Master Tasks:** Create and manage task templates
- **User Management:** Assign users to positions
- **Reports:** Comprehensive analytics and reporting
- **System Settings:** Configure application behavior
- **Background Jobs:** Monitor automated processes

### Troubleshooting Admin Access
If you encounter authentication errors:
1. Clear browser localStorage: `localStorage.clear()`
2. Refresh the page
3. Login again with Administrator credentials
4. Ensure you're using the correct position (Administrator, not other roles)

The application is designed to be development-friendly with comprehensive error reporting and detailed logging for easy troubleshooting and maintenance.