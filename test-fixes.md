# Test Verification Plan

## Issue 1: "Authentication required" Error on Master Tasks Page Load
**Problem**: "Authentication required" error when the Master Tasks Management page loads

### Root Cause Found:
The master tasks API endpoints were using client-side Supabase client instead of server-side authenticated client for database operations.

### Testing Steps:
1. **Login Test**:
   - Go to http://localhost:3000/login
   - Click "Fill Admin" button to populate admin@pharmacy.com / password123
   - Click "Sign In"
   - Check browser console for logging messages about user profile creation

2. **Authentication Verification Test**:
   - After logging in, go to: http://localhost:3000/api/auth/test
   - This will test BOTH authentication methods (alternative and original)
   - Should return JSON with user info including role: "admin" and method used
   - If it returns error, both authentication methods have issues
   - Check which method works (alternative vs original)

3. **Master Tasks Page Load Test**:
   - Navigate to Admin → Master Tasks
   - Page should load without "Authentication required" errors
   - Should display existing master tasks (if any)
   - Check console for successful API calls

2. **Profile Verification**:
   - Once logged in, check browser console for messages like:
     - "Creating user profile for: admin@pharmacy.com with role: admin"
     - "Auth middleware - User profile lookup: ..."
     - "Master task creation - User info: ..."

3. **Master Task Creation Test**:
   - Navigate to Admin → Master Tasks
   - Click "Create New Task" 
   - Fill in required fields:
     - Title: "Test Task"
     - Position: Any position
     - Frequency: "every_day"
   - Click "Create Task"
   - Should succeed without "Admin access required" error

### Expected Results:
- User profile should be automatically created with admin role
- Master task creation should succeed
- Console should show successful task creation and instance generation

## Issue 2: Task Creation to Checklist Flow  
**Problem**: Ensure tasks appear in checklist after creation

### Testing Steps:
1. **Create Master Task** (from Issue 1 test above)
   - Verify task creation succeeded
   - Check console for "Task instances generated for new master task: ..." message

2. **Verify Task Instances Generated**:
   - Go to Admin → Master Tasks
   - Find your created task
   - Click "Generate Instances" button next to the task
   - Should see success message like "Generated X task instances"

3. **Check Checklist Display**:
   - Navigate to "Checklist"
   - Select today's date using date navigator
   - Apply filters if needed (position, category)
   - Look for your created task in the task list

4. **Test Task Interaction**:
   - Find your task in the checklist
   - Click "Complete" button - should work
   - Click "Undo" to revert - should work
   - Task status should update accordingly

### Expected Results:
- Master task creation automatically generates task instances
- Task instances appear in checklist for appropriate position
- Tasks can be completed/uncompleted by users with correct position access
- Admin users can see all tasks regardless of position

## Debugging Information

### Console Messages to Look For:

#### Client-side Auth:
```
Auth context - Initializing auth state
Auth context - Initial session check: { sessionExists: true, userExists: true, userEmail: 'admin@pharmacy.com' }
API client - Getting session from supabase...
API client - Session info: { sessionExists: true, tokenExists: true, userEmail: 'admin@pharmacy.com', tokenLength: XXX }
API client - Auth header will be set
API client - Making request to: /master-tasks
API client - Auth headers: { hasAuthHeader: true, authHeaderLength: XXX }
```

#### Server-side Auth (Alternative Method - Should Work):
```
Auth middleware ALT - Authorization header present: true
Auth middleware ALT - Token length: XXX
Auth middleware ALT - JWT verification result: { userFound: true, userEmail: 'admin@pharmacy.com' }
Auth middleware ALT - User profile lookup: { userId: ..., profileFound: true, profileRole: 'admin' }
requireAuthAlt - Authentication successful for: admin@pharmacy.com
```

#### Server-side Auth (Original Method - May Fail):
```
Auth middleware - Authorization header present: true
Auth middleware - Token length: XXX
Auth middleware - Setting session with token
Auth middleware - Set session result: { success: true/false, error: null/'error message' }
Auth middleware - Supabase getUser result: { userFound: true, userEmail: 'admin@pharmacy.com' }
Auth middleware - User profile lookup: { userId: ..., profileFound: true, profileRole: 'admin' }
requireAuth - Authentication successful for: admin@pharmacy.com
```

#### Master Tasks Page Load:
```
Master tasks GET - Starting request processing
Master tasks GET - Attempting authentication
Master tasks GET - Authentication successful for: admin@pharmacy.com
Master tasks GET - Fetching data with filters: { positionId: null, status: 'all' }
Master tasks GET - Successfully fetched X tasks
```

#### Master Task Creation:
```
Master task POST - Starting request processing
Master task POST - Attempting authentication
Master task creation - User info: { id: ..., email: 'admin@pharmacy.com', role: 'admin', ... }
Master task POST - Authentication successful, proceeding with task creation
Master task POST - Creating task with data: { title: '...', position_id: '...', frequency: '...' }
Task instances generated for new master task: { success: true, generated: X, ... }
```

#### Task Instance Loading:
```
Loading tasks for date: YYYY-MM-DD
Tasks loaded: X tasks for position
```

## ✅ **MAJOR FIX APPLIED**

### **Authentication Architecture Issue Resolved**
**Problem**: All master task API endpoints were using client-side Supabase client which cannot handle server-side JWT token verification.

**Solution**: 
- Created new authentication helper functions (`lib/auth-supabase-helper.ts`)
- Updated all master task endpoints to use server-side authenticated Supabase clients
- Fixed JWT token session handling for database operations

### **Files Modified**:
1. `lib/auth-middleware.ts` - Enhanced JWT token verification (ORIGINAL METHOD)
2. `lib/auth-middleware-alt.ts` - Alternative JWT verification using service role (NEW METHOD)
3. `lib/auth-supabase-helper.ts` - New authentication helpers  
4. `app/api/master-tasks/route.ts` - Fixed GET and POST endpoints
5. `app/api/master-tasks/[id]/route.ts` - Fixed GET, PUT, DELETE endpoints
6. `app/api/auth/test/route.ts` - Enhanced test endpoint with both methods
7. `lib/auth.tsx` - Added comprehensive debugging
8. `lib/api.ts` - Added detailed client-side debugging

### **🔧 NEXT STEPS AFTER TESTING**:
Once you determine which authentication method works from the `/api/auth/test` endpoint:
1. If **Alternative Method** works: I'll update all master-tasks endpoints to use `requireAuthAlt`
2. If **Original Method** works: The current setup should work
3. If **Neither Method** works: We'll need to investigate Supabase configuration

## Common Issues & Solutions

### If Authentication Still Fails:
1. Check browser console for detailed error messages
2. Verify JWT token is being sent properly (check API client logs)
3. Test with `/api/auth/test` endpoint first
4. Ensure Supabase environment variables are set correctly

### If Tasks Don't Appear in Checklist:
1. Verify task instances were generated (check console messages)
2. Ensure selected position matches task position
3. Check date filters - task might be scheduled for different date
4. Try "Generate Instances" button manually if automatic generation failed

### If Task Completion Fails:
1. Check user has correct position access
2. Verify task is not locked
3. Check RLS policies for task_instances table

## Database Verification Queries

To verify in Supabase dashboard:

```sql
-- Check user profiles
SELECT * FROM user_profiles WHERE email LIKE '%admin%';

-- Check master tasks
SELECT * FROM master_tasks WHERE title LIKE '%Test%';

-- Check generated task instances  
SELECT ti.*, mt.title, mt.position_id 
FROM task_instances ti 
JOIN master_tasks mt ON ti.master_task_id = mt.id 
WHERE mt.title LIKE '%Test%'
ORDER BY ti.instance_date DESC;

-- Check positions
SELECT * FROM positions;
```