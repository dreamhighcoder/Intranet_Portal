# 🚀 Pharmacy Intranet Portal - Setup Guide

**Complete setup in 3 simple steps for production-ready deployment**

## 📋 What You Get

- **9 Database Tables**: positions, users, tasks, holidays, audit, settings, etc.
- **20+ RLS Policies**: Secure position-based access control
- **3 Reporting Views**: Ready-made dashboard queries
- **Complete Sample Data**: Positions, settings, holidays, sample tasks
- **Production-Ready**: Optimized, clean, and fully functional

## 🔧 Setup Instructions

### Step 1: Create Supabase Project
1. Go to [supabase.com](https://supabase.com) and create a new project
2. **New project** → Choose organization → Project name: "pharmacy-portal"
3. **Generate password** (save it!) → Select region closest to your location
4. Wait 2-3 minutes for initialization

### Step 2: Configure Authentication
In Supabase Dashboard → **Authentication** → **Settings**:
- ✅ **Disable signup** (admin controls users)
- ✅ **Disable email confirmations** (for shared logins)
- ⚙️ **JWT expiry**: 86400 seconds (24 hours)

### Step 3: Setup Database
In Supabase Dashboard → **SQL Editor**, execute **in this exact order**:

#### 3.1 Create Schema & Tables
```sql
-- Copy and paste ENTIRE contents of: supabase/schema.sql
```
✅ Creates all tables, indexes, policies, views, functions

#### 3.2 Apply Row Level Security Policies
```sql
-- Copy and paste ENTIRE contents of: supabase/rls-policies.sql
```
✅ Creates secure access control policies

#### 3.3 Insert Sample Data
```sql
-- Copy and paste ENTIRE contents of: supabase/seed-data.sql  
```
✅ Creates positions, settings, holidays, sample tasks

#### 3.4 Verify Setup
```sql
-- Copy and paste ENTIRE contents of: supabase/verify-setup.sql
```
✅ Checks everything is working correctly

## ✅ Verification Checklist

After running all scripts, you should see:
- ✅ **9 tables created** (positions, user_profiles, master_tasks, etc.)
- ✅ **6 positions inserted** (Pharmacist Primary, Supporting, etc.)
- ✅ **25+ system settings** (timezone, business rules, etc.)  
- ✅ **15+ public holidays** (Australian calendar)
- ✅ **7+ sample tasks** (daily, weekly, monthly patterns)
- ✅ **20+ RLS policies** (security rules)
- ✅ **3 reporting views** (dashboards)

## 🔑 Create First Admin User

Since signup is disabled, manually create your admin user:

1. **In Supabase Dashboard → Authentication → Users:**
   - Click **"Add user"**
   - Email: `admin@yourpharmacy.com`
   - Password: `ChangeMe123!` (change on first login!)
   - Confirm password and click **"Add user"**

2. **Get the User ID and create profile in SQL Editor:**
```sql
-- Get the user ID
SELECT id, email FROM auth.users WHERE email = 'admin@yourpharmacy.com';

-- Create admin profile (replace USER_ID_HERE with actual ID from above)
INSERT INTO user_profiles (
  id,
  display_name,
  position_id,
  role
) VALUES (
  'USER_ID_HERE',  -- Replace with actual UUID from above
  'System Administrator',
  (SELECT id FROM positions WHERE name = 'Operational/Managerial'),
  'admin'
);
```

## 🏪 Environment Variables

Create `.env.local` in your project root:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Optional: For production cron jobs
CRON_API_KEY=your_secure_api_key
NEXT_PUBLIC_SITE_URL=https://your-domain.com
```

## 🚀 Start Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm run dev
```

Visit http://localhost:3000/login and use your admin credentials.

## 🏪 Customize for Your Pharmacy

### Basic Settings (in SQL Editor):
```sql
-- Set your timezone
UPDATE system_settings SET value = 'Australia/Melbourne' WHERE key = 'timezone';

-- Set your pharmacy name  
UPDATE system_settings SET value = 'Your Pharmacy Name' WHERE key = 'pharmacy_name';

-- Set business hours
UPDATE system_settings SET value = '08:00' WHERE key = 'workday_start_time';
UPDATE system_settings SET value = '18:00' WHERE key = 'workday_end_time';
```

## 📊 Database Schema

### Core Tables
- **`positions`** - Job roles (Pharmacist Primary, Supporting, etc.)
- **`user_profiles`** - Extended user info with role and position
- **`master_tasks`** - Task templates with recurrence rules
- **`task_instances`** - Individual task occurrences
- **`public_holidays`** - Holiday calendar with substitution rules
- **`audit_log`** - Complete action history
- **`system_settings`** - Configuration management

### Security Features
- **Position-Based Access**: Users only see tasks for their position
- **Task Locking**: Prevents editing missed tasks (unless allowed)
- **Complete Audit Trail**: Every action logged with user & timestamp
- **Auto-logout**: Prevents account misuse on shared computers

## 🎯 Production Deployment

### Background Jobs (Cron)
Set up these endpoints to run automatically:
- **Daily at 12:01 AM**: `GET /api/jobs/generate-instances?mode=daily`
- **Every hour**: `GET /api/jobs/update-statuses`

### Performance Tips
- **Database**: Regularly run `ANALYZE;` for query optimization
- **Caching**: Consider Redis for high-traffic deployments
- **Monitoring**: Set up health checks on `/api/health`

## 🆘 Troubleshooting

**"Permission denied" errors:**
- Check user has correct role in `user_profiles` table
- Verify RLS policies exist: `SELECT * FROM pg_policies;`

**Tasks not showing:**  
- Check `publish_status = 'active'` in `master_tasks`
- Verify `is_published = true` in `task_instances`
- Confirm user has correct `position_id`

**Performance issues:**
- Run `ANALYZE;` to update query stats
- Check indexes: `SELECT * FROM pg_indexes WHERE schemaname = 'public';`

## 📁 Project Structure

```
├── app/                    # Next.js app router
│   ├── api/               # API routes
│   ├── admin/             # Admin-only pages
│   └── login/             # Authentication
├── components/            # Reusable React components
│   ├── ui/               # UI primitives  
│   └── admin/            # Admin-specific components
├── lib/                  # Core business logic
│   ├── supabase.ts       # Database client & types
│   ├── auth.tsx          # Authentication context
│   └── recurrence-engine.ts    # Task recurrence logic
└── supabase/             # Database schema & seed data
    ├── schema.sql        # Complete database schema
    ├── rls-policies.sql  # Row Level Security policies
    ├── seed-data.sql     # Initial sample data
    └── verify-setup.sql  # Setup verification
```

---

🎉 **That's it!** Your pharmacy intranet portal is now ready with all features from the specification including position-based security, complex recurrence patterns, public holiday substitutions, auto-logout functionality, complete audit logging, and Australian pharmacy compliance.