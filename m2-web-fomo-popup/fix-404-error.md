# 🔧 Fix 404 Error - Route Not Found

## 🎯 **Problem:**
Getting 404 error for `/apps/fomo/status` endpoint

## ✅ **Solutions:**

### **Solution 1: Check Route File Deployment**
Make sure this file is uploaded to your Plesk server:
```
app/routes/proxy.fomo.$subpath.jsx
```

### **Solution 2: Verify App Proxy Configuration**
Check your `shopify.app.toml` file:
```toml
[app_proxy]
url = "https://fomoapp.smartreminder.in/proxy/fomo"
subpath = "fomo"
prefix = "apps"
```

### **Solution 3: Test Different URLs**

#### **Test 1: Basic Popup Endpoint**
```
https://fomoapp.smartreminder.in/apps/fomo/popup?shop=testing-m2web.myshopify.com
```

#### **Test 2: Status Endpoint**
```
https://fomoapp.smartreminder.in/apps/fomo/status?shop=testing-m2web.myshopify.com
```

#### **Test 3: Debug Endpoint**
```
https://fomoapp.smartreminder.in/apps/fomo/debug?shop=testing-m2web.myshopify.com
```

### **Solution 4: Check Server Logs**
In Plesk, check:
1. **Error Logs** → Domain logs
2. Look for any PHP/Node.js errors
3. Check if the route file is being loaded

### **Solution 5: Verify File Structure on Plesk**
Make sure your Plesk server has:
```
httpdocs/
├── app/
│   └── routes/
│       └── proxy.fomo.$subpath.jsx
├── package.json
├── .env
└── prisma/
    └── schema.prisma
```

### **Solution 6: Restart Application**
In Plesk Terminal:
```bash
cd /var/www/vhosts/fomoapp.smartreminder.in/httpdocs
npm restart
# OR
pm2 restart all
```

## 🚨 **Quick Debug Steps:**

### **1. Check if Route File Exists:**
```bash
ls -la app/routes/proxy.fomo.$subpath.jsx
```

### **2. Check Node.js App is Running:**
```bash
ps aux | grep node
```

### **3. Check App Proxy Configuration:**
Verify in Shopify Partner Dashboard:
- App URL: `https://fomoapp.smartreminder.in`
- App Proxy URL: `https://fomoapp.smartreminder.in/proxy/fomo`
- Subpath: `fomo`
- Prefix: `apps`

## 🎯 **Alternative: Direct Database Fix**
If routes are not working, directly update database:

```sql
UPDATE `Shop` 
SET `themeExtensionEnabled` = 1 
WHERE `shop` = 'testing-m2web.myshopify.com';
```

## ✅ **Expected Working URLs:**
After fix, these should work:
- Status: `https://fomoapp.smartreminder.in/apps/fomo/status?shop=testing-m2web.myshopify.com`
- Popup: `https://fomoapp.smartreminder.in/apps/fomo/popup?shop=testing-m2web.myshopify.com`
