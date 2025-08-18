# 🏥 Pharmacy Intranet Portal

A Next.js-based intranet portal for pharmacy task management with role-based access control, automated task generation, and comprehensive reporting features.

## 📋 Overview

This application allows pharmacists to track, manage, and complete daily tasks with:
- **Role-based Authentication** (Admin/Viewer roles)
- **Position-based Task Assignment** (Pharmacist Primary, Supporting, Assistants)
- **Automated Task Generation** with complex recurrence patterns
- **Real-time Status Management** and audit logging
- **Comprehensive Reporting** and analytics dashboard

## 🚀 Quick Setup

**Prerequisites:** Node.js 18+ and pnpm, Supabase account

**Setup Steps:**
1. Clone repository and install dependencies:
   ```bash
   pnpm install
   ```

2. Set up environment variables:
   ```bash
   cp .env.template .env.local
   # Edit .env.local with your Supabase credentials
   ```

3. Set up database (run SQL scripts in Supabase Dashboard in order):
   ```bash
   # 1. supabase/schema.sql - Database schema
   # 2. supabase/rls-policies.sql - Security policies  
   # 3. supabase/seed-data.sql - Initial data
   # 4. supabase/verify-setup.sql - Verification
   ```

4. Start development server:
   ```bash
   pnpm run dev
   ```

Visit http://localhost:3000/login with your admin credentials.

## 🏗️ Architecture

### Tech Stack
- **Framework:** Next.js 15.2.4 with React 19
- **Database:** Supabase (PostgreSQL)
- **Authentication:** Supabase Auth
- **Styling:** Tailwind CSS 4.1.9
- **Forms:** React Hook Form + Zod validation
- **Charts:** Recharts
- **Package Manager:** pnpm

### Project Structure
```
├── app/                    # Next.js app router
│   ├── api/               # API routes
│   ├── admin/             # Admin-only pages
│   ├── login/             # Authentication
│   └── ...                # Other app pages
├── components/            # Reusable React components
│   ├── ui/               # UI primitives
│   └── admin/            # Admin-specific components
├── lib/                  # Core business logic
│   ├── supabase.ts       # Database client & types
│   ├── auth.tsx          # Authentication context
│   ├── api.ts            # API service layer
│   ├── recurrence-engine.ts    # Task recurrence logic
│   ├── task-instance-generator.ts  # Automated task creation
│   └── status-manager.ts       # Task status automation
├── supabase/             # Database schema & seed data
│   ├── rls-policies.sql  # Row Level Security policies
│   └── seed-data.sql     # Initial data
└── scripts/              # Utility scripts
```

## 🔧 Features

### Core Features
- ✅ **Authentication & Authorization** - Supabase Auth with role-based access
- ✅ **User Profile Management** - Automatic profile creation with position assignment
- ✅ **Task Management** - Create, assign, and track tasks across different positions
- ✅ **Automated Task Generation** - 10 different recurrence patterns (daily, weekly, monthly, etc.)
- ✅ **Real-time Status Updates** - Automatic status transitions based on time and completion
- ✅ **Audit Logging** - Complete trail of all task actions
- ✅ **Public Holiday Integration** - Automatic date shifting for non-business days

### Admin Features
- ✅ **Master Task Templates** - Create and manage recurring task templates
- ✅ **User & Position Management** - Assign users to positions
- ✅ **KPI Dashboard** - Real-time metrics and performance tracking
- ✅ **Advanced Reports** - Task completion rates, missed tasks, position performance
- ✅ **Background Job Management** - Monitor automated task generation and status updates

### Task Recurrence Engine
Supports complex scheduling patterns:
- **Daily** - Every day or every N days
- **Weekly** - Specific days of week
- **Monthly** - Specific day of month or relative (1st Monday, last Friday)
- **Quarterly/Yearly** - Advanced business scheduling
- **Business Days Only** - Automatic holiday handling

## 📊 Database Schema

### Core Tables
- `positions` - Job roles (Pharmacist Primary, Supporting, Assistants)
- `user_profiles` - User information and role assignments  
- `master_tasks` - Recurring task templates
- `task_instances` - Individual task occurrences
- `public_holidays` - Holiday calendar for date shifting
- `audit_log` - Complete audit trail

### Row Level Security (RLS)
- **Admins:** Full access to all data
- **Viewers:** Access only to tasks for their position
- **Users:** Can read own profile, update task completions

## 🚀 Production Scripts

### Database Setup
```bash
# Set up database schema and initial data
pnpm run setup-db
```

### Automated Background Jobs
```bash
# Daily task generation (development)
pnpm run generate-tasks

# Status updates (development) 
pnpm run update-statuses

# Production versions (require CRON_API_KEY)
pnpm run generate-tasks-prod
pnpm run update-statuses-prod
```

## 🔍 API Endpoints

### Authentication
- `GET/POST /api/auth/*` - Supabase Auth integration

### Core Data
- `GET/POST /api/positions` - Position management
- `GET/POST/PUT/DELETE /api/master-tasks` - Task templates
- `GET/POST/PUT /api/task-instances` - Individual tasks
- `GET/POST /api/user-profiles` - User management

### Background Jobs
- `GET /api/jobs/generate-instances` - Generate daily tasks
- `GET /api/jobs/update-statuses` - Update task statuses

### Reporting & Analytics
- `GET /api/reports/kpis` - Key performance indicators
- `GET /api/reports/completion-rates` - Task completion analytics
- `GET /api/audit-log` - Audit trail access

## 🛠️ Development

### Running Tests
```bash
# The app includes built-in error handling and logging
# Monitor browser console and server logs for debugging
```

### Database Migrations
```bash
# Use Supabase Dashboard for schema changes
# Update supabase/rls-policies.sql for RLS changes
```

### Adding New Recurrence Patterns
1. Update `lib/recurrence-engine.ts` with new pattern logic
2. Add corresponding UI controls in admin task forms
3. Test with `task-instance-generator.ts`

## 🔒 Security Features

- **Row Level Security (RLS)** - Database-level access control
- **JWT Authentication** - Secure session management via Supabase
- **API Route Protection** - Server-side auth verification
- **Role-based UI** - Dynamic interface based on user permissions
- **Audit Trail** - Complete logging of all data changes

## 🆘 Troubleshooting

### Common Issues

**"Error fetching position" in console:**
- Run the updated RLS function in Supabase Dashboard SQL Editor
- Check that user profiles have valid position_id values

**Login issues:**
- Verify users exist in Supabase Auth Dashboard
- Check environment variables in `.env.local`
- Ensure RLS policies are applied correctly

**Task generation issues:**
- Check that master tasks have valid position assignments
- Verify public holidays table is populated
- Monitor API logs for recurrence engine errors

### Debug Mode
The app includes comprehensive logging. Check browser console and server logs for detailed error information.

## 📄 License

This project is private and confidential. All rights reserved.

---

**Need help?** Check the browser console for detailed error messages. The application is designed to be development-friendly with comprehensive error reporting.