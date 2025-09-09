# Auto-Logout Debug Information

## Issue Fixed
The auto-logout functionality was using hardcoded default values (5 minutes) instead of loading from the database because the timer was being set up before the settings were loaded.

## Changes Made

### 1. Position Auth Context (`lib/position-auth-context.tsx`)
- Added `settingsLoaded` state to track when settings are loaded
- Modified useEffect to only set up auto-logout when both user is logged in AND settings are loaded
- Added more detailed debugging logs

### 2. System Settings (`lib/system-settings.ts`)
- Added debugging to show what values are loaded from database
- Added conversion debugging for auto-logout delay (seconds → minutes)

## Expected Debug Messages

When you refresh the browser and log in, you should see these messages in the console:

1. **Settings Loading:**
   ```
   🔄 Loading auto-logout settings from database...
   🔍 Settings loaded from database: {totalRows: 15, autoLogoutDelaySeconds: 60, autoLogoutEnabled: true, ...}
   🔄 Auto-logout delay conversion: {fromDatabase: 60, convertedToMinutes: 1}
   ✅ Final merged settings: {auto_logout_delay_minutes: 1, auto_logout_enabled: true, ...}
   🔧 Auto-logout settings loaded: {enabled: true, delayMinutes: 1}
   ```

2. **Auto-Logout Setup:**
   ```
   👤 User logged in and settings loaded, setting up auto-logout functionality
   📊 Current auto-logout settings: {enabled: true, delayMinutes: 1}
   ⏱️ Setting inactivity timer for 1 minutes
   ```

## Database Values
From your database export, the current values are:
- `auto_logout_delay_seconds`: "60" (1 minute)
- `auto_logout_enabled`: "true"

## Expected Behavior
- Timer should now be set to 1 minute (not 5 minutes)
- After 1 minute of inactivity, you should be automatically logged out
- Console should show "⏰ Inactivity timeout reached, performing auto-logout"

## Testing Steps
1. Refresh the browser
2. Log in to the application
3. Check console for the debug messages above
4. Verify the timer shows "1 minutes" not "5 minutes"
5. Don't interact with the page for 1 minute
6. Verify you get logged out automatically