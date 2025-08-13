---
description: Repository Information Overview
alwaysApply: true
---

# Pharmacy Intranet Portal Information

## Summary
A Next.js-based intranet portal for pharmacy task management. The application allows pharmacists to track, manage, and complete daily tasks with role-based access control. It uses Supabase for authentication and database storage.

**Status**: Production-ready, optimized codebase with comprehensive features and clean documentation. Optimized and cleaned up for production use.

## Structure
- **app/**: Next.js app router components and API routes
- **components/**: Reusable React components
- **lib/**: Utility functions, types, and Supabase client
- **public/**: Static assets
- **styles/**: Global CSS styles
- **supabase/**: Database migrations and seed data
- **scripts/**: Setup and maintenance scripts

## Language & Runtime
**Language**: TypeScript
**Version**: TypeScript 5.x
**Framework**: Next.js 15.2.4
**Runtime**: React 19
**Build System**: Next.js build system
**Package Manager**: pnpm

## Dependencies
**Main Dependencies**:
- Next.js 15.2.4 (React framework)
- React 19 (UI library)
- @supabase/supabase-js 2.55.0 (Database client)
- date-fns 4.1.0 (Date utilities)
- zod 3.25.67 (Schema validation)
- react-hook-form 7.60.0 (Form handling)
- recharts (Charting library)
- tailwindcss 4.1.9 (CSS framework)

**Development Dependencies**:
- TypeScript 5.x
- tsx 4.19.2 (TypeScript execution)
- @types/react 19
- @types/node 22

## Build & Installation
```bash
# Install dependencies
pnpm install

# Set up environment variables
cp .env.template .env.local
# Edit .env.local with your Supabase credentials

# Set up database
pnpm run setup-db

# Development server
pnpm run dev

# Production build
pnpm run build
pnpm run start
```

## Database
**Provider**: Supabase
**Tables**:
- positions (job roles)
- master_tasks (task templates)
- task_instances (individual tasks)
- public_holidays
- audit_log
- user_profiles

**Setup**:
- Database schema in `supabase/rls-policies.sql`
- Initial data in `supabase/seed-data.sql`
- Setup script: `scripts/setup-database.ts`

## Authentication
**Provider**: Supabase Auth
**Roles**:
- admin: Full access to all features
- viewer: Limited to viewing and completing tasks

## API Routes
**Endpoints**:
- `/api/auth`: Authentication endpoints
- `/api/master-tasks`: Task template management
- `/api/task-instances`: Individual task management
- `/api/jobs`: Background jobs for task generation
- `/api/reports`: Reporting endpoints

## Scheduled Jobs
**Task Generation**:
```bash
# Development
pnpm run generate-tasks

# Production
pnpm run generate-tasks-prod
```

**Status Updates**:
```bash
# Development
pnpm run update-statuses

# Production
pnpm run update-statuses-prod
```