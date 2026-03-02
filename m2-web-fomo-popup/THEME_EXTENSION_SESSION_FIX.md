# Theme Extension Session Fix

## Problem
The "Session not ready" error occurs when your Shopify theme app extension cannot establish a proper session with your app. This typically happens because:

1. Theme extensions run in the storefront context, not the admin context
2. Session management needs special handling for theme extensions
3. Third-party cookies might be blocked
4. The app might not be properly installed or authenticated

## Solution Implemented

### 1. Theme Embed Route (`app/routes/app.theme-embed.jsx`)
- Created a dedicated route for theme extension session management
- Handles both GET and POST requests
- Returns session status and shop information
- Includes proper CORS headers

### 2. Enhanced Proxy Route (`app/routes/proxy.fomo.$subpath.jsx`)
- Added session validation endpoint (`/session`)
- Enhanced popup endpoint with session checks
- Proper shop name normalization
- Better error handling and session status reporting

### 3. Updated Theme Extension JavaScript (`extensions/fomo-popup/assets/m2fomo.js`)
- Added session management functions
- Automatic session checking with retry logic
- Waits for session before making API calls
- Better error handling and user feedback

### 4. Debug Route (`app/routes/app.theme-embed.debug.jsx`)
- Provides detailed debugging information
- Shows shop status, configurations, and sessions
- Helps troubleshoot session issues

## How It Works

1. **Session Check**: The theme extension first calls `/apps/fomo/session?shop=SHOP_NAME` to check if the session is ready
2. **Retry Logic**: If session is not ready, it retries up to 3 times with 2-second intervals
3. **Popup Request**: Only after session is confirmed, it makes the popup request
4. **Error Handling**: Clear error messages and logging for debugging

## Testing the Fix

### 1. Check Session Status
Visit: `https://your-app-domain.com/apps/fomo/session?shop=your-shop-name`

Expected response:
```json
{
  "sessionReady": true,
  "shop": "your-shop.myshopify.com",
  "installed": true,
  "timestamp": 1234567890
}
```

### 2. Debug Information
Visit: `https://your-app-domain.com/apps/fomo/debug?shop=your-shop-name`

This will show detailed information about:
- Shop installation status
- Notification configurations
- Recent sessions
- Access tokens

### 3. Test Popup Endpoint
Visit: `https://your-app-domain.com/apps/fomo/popup?shop=your-shop-name`

Expected response:
```json
{
  "showPopup": true,
  "sessionReady": true,
  "records": [...],
  "shop": "your-shop.myshopify.com",
  "timestamp": 1234567890
}
```

## Troubleshooting

### If Session Still Not Ready:

1. **Check App Installation**:
   - Go to your Shopify admin
   - Navigate to Apps
   - Find your app and ensure it's installed
   - If not installed, install it first

2. **Check Third-Party Cookies**:
   - Ensure third-party cookies are allowed in the browser
   - Test in different browsers

3. **Verify Shop Name**:
   - Make sure the shop parameter matches exactly
   - Check for typos in the shop domain

4. **Check Database**:
   - Verify the shop exists in the database
   - Check that `installed` is set to `true`
   - Ensure `accessToken` is not null

5. **Check Logs**:
   - Look at browser console for error messages
   - Check server logs for any errors

### Common Issues:

1. **Shop Not Found**: The shop is not in the database or not properly installed
2. **Access Token Missing**: The app installation didn't complete properly
3. **CORS Issues**: Browser blocking requests due to CORS policy
4. **Network Issues**: Firewall or network blocking the requests

## Manual Session Recovery

If the automatic session recovery doesn't work, you can manually trigger it:

1. **Reinstall the App**:
   - Uninstall the app from Shopify admin
   - Reinstall it from the app store or development environment

2. **Clear Browser Cache**:
   - Clear cookies and cache for your store
   - Try in an incognito/private window

3. **Check App URL**:
   - Ensure the app URL in `shopify.app.toml` is correct
   - Verify the proxy URL configuration

## Files Modified

1. `app/routes/app.theme-embed.jsx` - New theme embed route
2. `app/routes/proxy.fomo.$subpath.jsx` - Enhanced proxy route
3. `extensions/fomo-popup/assets/m2fomo.js` - Updated theme extension JS
4. `app/routes/app.theme-embed.debug.jsx` - Debug route (optional)

## Next Steps

1. Deploy the updated code
2. Test the theme extension on a development store
3. Check the debug endpoint to verify everything is working
4. Monitor logs for any remaining issues

The session management should now be much more robust and provide clear feedback when issues occur.

