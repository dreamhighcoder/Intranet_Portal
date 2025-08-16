# Auto-Logout Testing Instructions

## 🚀 **Quick Test (10 seconds)**

1. **Set test mode**:
   ```bash
   node test-auto-logout.js start
   ```

2. **Open browser**: http://localhost:3001

3. **Login**: Use any admin account or position login

4. **Open DevTools**: Press F12 and go to Console tab

5. **Watch for logs**: You should see:
   ```
   🔧 Auth: Setting up inactivity monitoring for: user@example.com
   📡 Auth: Added mousemove listener
   📡 Auth: Added mousedown listener
   ... (other event listeners)
   🚀 Auth: Starting initial inactivity timer
   ⏰ Auth: Starting inactivity timer
   ✅ Auth: Timer set for 10000ms
   ```

6. **Stay completely idle**: Don't move mouse, don't click, don't type for 10+ seconds

7. **Expected result**: After 10 seconds:
   ```
   🚨 Auth: INACTIVITY TIMEOUT - Logging out user
   🚪 Auth: Performing inactivity logout
   ✅ Auth: Supabase signout complete
   ✅ Auth: Redirected to home page
   ```

8. **Restore production settings**:
   ```bash
   node test-auto-logout.js restore
   ```

## 🕐 **Full Test (5 minutes)**

1. **Skip test mode** - use production settings
2. **Login** to any account
3. **Wait 5 minutes** without any activity
4. **Should auto-logout** and redirect to home page

## 🔍 **Activity Reset Test**

1. **Login** to any account
2. **Open Console** (F12)
3. **Move mouse**: Should see `🎯 Auth: User activity detected at [time]`
4. **Each activity**: Resets the 5-minute timer

## 🐛 **Debugging**

### **No Console Logs?**
- Check if you're logged in
- Refresh the page after login
- Make sure DevTools Console is open

### **Timer Not Working?**
- Look for error messages in console
- Check if event listeners are being added
- Verify user context is properly set

### **Not Redirecting?**
- Check browser's Network tab for navigation
- Look for router errors in console
- Verify home page (/) loads correctly

## 📱 **Events That Reset Timer**
- Mouse movement
- Mouse clicks  
- Keyboard input
- Scrolling
- Touch events (mobile)
- Tab focus
- Tab becoming visible (switching back to tab)

## ✅ **Success Indicators**
- **Setup**: Console shows event listeners being added
- **Activity**: Console logs each user activity
- **Timeout**: Console shows timeout message and redirect
- **Redirect**: User lands on home page showing staff checklists

## ❌ **Failure Indicators**
- No console logs after login
- Timer doesn't start
- No activity detection logs when moving mouse
- Timeout doesn't trigger after expected time
- No redirect after timeout