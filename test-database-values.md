# Test Database Values

## Quick Test

After logging in, run this in the browser console:

```javascript
// Check what's in the database
fetch('/api/system-settings')
  .then(response => response.json())
  .then(data => {
    console.log('🔍 API Response:', data);
    console.log('🎯 Auto-logout settings from API:', {
      enabled: data.auto_logout_enabled,
      delayMinutes: data.auto_logout_delay_minutes
    });
  })
  .catch(error => console.error('❌ API Error:', error));

// Check what the context has loaded
console.log('🔍 Context state:', window.debugAutoLogout.getCurrentSettings());
```

## Expected Results

1. **API Response should show:**
   ```javascript
   {
     auto_logout_enabled: true,
     auto_logout_delay_minutes: 1
   }
   ```

2. **Context state should show:**
   ```javascript
   {
     enabled: true,
     delayMinutes: 1,
     settingsLoaded: true,
     hasActiveTimer: true,
     user: true
   }
   ```

## If Values Don't Match

If the API shows correct values (1 minute) but the context shows wrong values (5 minutes), then there's a timing issue in the loading sequence.

## Manual Fix Test

If the values are wrong, try this in console:
```javascript
// Force reload settings
await window.debugAutoLogout.forceReloadSettings();

// Check again
console.log('After reload:', window.debugAutoLogout.getCurrentSettings());

// Reset timer with new values
window.debugAutoLogout.resetTimer();
```