# Final Auto-Logout Debug Guide

## Changes Made

### 1. Fixed Sign-In Flow
- Added `loadAutoLogoutSettings(true)` immediately after successful login
- This ensures settings are loaded fresh when user signs in

### 2. Added Debug Functions
- Exposed `window.debugAutoLogout` object for testing
- Enhanced console logging with more details

### 3. Created Test Page
- `test-auto-logout-simple.html` with countdown timer
- Helps track when auto-logout should happen

## Testing Steps

### Step 1: Check Current State
After logging in, run this in browser console:
```javascript
window.debugAutoLogout.getCurrentSettings()
```

Expected result:
```javascript
{
  enabled: true,
  delayMinutes: 1,
  settingsLoaded: true,
  hasActiveTimer: true,
  user: true
}
```

### Step 2: Force Reload Settings
If settings are wrong, run:
```javascript
await window.debugAutoLogout.forceReloadSettings()
window.debugAutoLogout.getCurrentSettings()
```

### Step 3: Manual Test Auto-Logout
To test if the logout function works:
```javascript
window.debugAutoLogout.triggerAutoLogout()
```

### Step 4: Check Console Messages
After logging in, you should see these messages in order:

1. **During Login:**
   ```
   🔄 User signed in, loading auto-logout settings...
   🔄 Loading auto-logout settings from database...
   🔍 Querying system_settings table...
   📊 Database query result: {rowCount: 15, ...}
   🔍 Settings loaded from database: {autoLogoutDelaySeconds: 60, ...}
   🔄 Auto-logout delay conversion: {fromDatabase: 60, convertedToMinutes: 1}
   ✅ Final merged settings: {auto_logout_delay_minutes: 1, ...}
   🔧 Auto-logout settings loaded: {enabled: true, delayMinutes: 1, ...}
   ```

2. **Setting Up Auto-Logout:**
   ```
   👤 User logged in and settings loaded, setting up auto-logout functionality
   📊 Current auto-logout settings: {enabled: true, delayMinutes: 1}
   ⏱️ Setting inactivity timer for 1 minutes
   ```

3. **After 1 Minute of Inactivity:**
   ```
   ⏰ Inactivity timeout reached, performing auto-logout
   ⏰ Auto-logout triggered due to inactivity
   ```

## Troubleshooting

### Issue 1: Timer Shows 5 Minutes
If you see "Setting inactivity timer for 5 minutes":
- Settings not loaded from database
- Check database connection
- Run `window.debugAutoLogout.forceReloadSettings()`

### Issue 2: No Timer Set Up
If `hasActiveTimer: false`:
- Check if `settingsLoaded: true`
- Check if `user: true`
- Check if `enabled: true`

### Issue 3: Settings Not Loading
If database query fails:
- Check Supabase connection
- Check if `system_settings` table exists
- Check if `auto_logout_delay_seconds` row exists with value 60

### Issue 4: Timer Not Triggering
If timer is set but doesn't trigger after 1 minute:
- Check if you're interacting with the page (mouse, keyboard)
- Any activity resets the timer
- Use the test page with countdown to avoid accidental activity

## Quick Fix Commands

Run these in browser console:

```javascript
// Check current state
console.log('Current state:', window.debugAutoLogout.getCurrentSettings());

// Force reload settings
await window.debugAutoLogout.forceReloadSettings();

// Reset timer manually
window.debugAutoLogout.resetTimer();

// Test logout function
// window.debugAutoLogout.triggerAutoLogout(); // Uncomment to test
```

## Expected Flow
1. User logs in → Settings loaded → Timer set for 1 minute
2. User activity → Timer resets to 1 minute
3. No activity for 1 minute → Auto logout → Redirect to login page

The key fix was ensuring settings are loaded immediately after login, not just on app startup.