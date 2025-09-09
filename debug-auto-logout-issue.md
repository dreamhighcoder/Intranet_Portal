# Debug Auto-Logout Issue

## Current Problem
- Database has `auto_logout_delay_seconds` = 60 (1 minute)
- System is still logging out after 5 minutes instead of 1 minute
- This suggests the system is using hardcoded defaults instead of database values

## Debugging Steps

### Step 1: Test Database Connection
1. Go to: http://localhost:3001/debug-settings
2. Click "Test Settings Loading"
3. Check browser console for debug messages
4. Verify the raw database data shows `auto_logout_delay_seconds: 60`

### Step 2: Check Settings Processing
Look for these console messages:
```
🔍 Querying system_settings table...
📊 Database query result: {rowCount: 15, ...}
🔍 Settings loaded from database: {autoLogoutDelaySeconds: 60, ...}
🔄 Auto-logout delay conversion: {fromDatabase: 60, convertedToMinutes: 1}
✅ Final merged settings: {auto_logout_delay_minutes: 1, ...}
```

### Step 3: Check Auto-Logout Context
After logging in, look for:
```
🔧 Auto-logout settings loaded: {enabled: true, delayMinutes: 1}
👤 User logged in and settings loaded, setting up auto-logout functionality
📊 Current auto-logout settings: {enabled: true, delayMinutes: 1}
⏱️ Setting inactivity timer for 1 minutes
```

## Possible Issues

### Issue 1: Database Connection Problem
- If you see "No system settings found" → Database connection issue
- If you see error messages → Check Supabase configuration

### Issue 2: Cache Problem
- Settings might be cached with old values
- Solution: Clear cache and force refresh

### Issue 3: Conversion Problem
- Database has seconds (60), frontend expects minutes (1)
- Check if conversion is working: 60 seconds ÷ 60 = 1 minute

### Issue 4: Timing Problem
- Timer set before settings loaded
- Solution: Only set timer after settings are loaded

## Expected Flow
1. User logs in
2. `loadAutoLogoutSettings(true)` called with force refresh
3. Database queried for fresh settings
4. `auto_logout_delay_seconds: 60` converted to `auto_logout_delay_minutes: 1`
5. Timer set for 1 minute
6. After 1 minute of inactivity → auto logout

## Quick Fix Test
Run this in browser console after logging in:
```javascript
// Check current settings
console.log('Current refs:', {
  enabled: window.autoLogoutEnabledRef?.current,
  delay: window.autoLogoutDelayRef?.current
});

// Force reload settings
import('./lib/system-settings.js').then(module => {
  module.clearSettingsCache();
  return module.getSystemSettings(true);
}).then(settings => {
  console.log('Fresh settings:', settings);
});
```