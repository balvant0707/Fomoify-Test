# 🔧 Fix Session Error - Step by Step

## 🎯 **Problem:**
Your database shows `themeExtensionEnabled = 0` for shop `testing-m2web.myshopify.com`

## ✅ **Solution:**

### **Step 1: Update Database (PHPMyAdmin ma)**
1. Open PHPMyAdmin
2. Select `m2websol_fomoapp` database
3. Go to `Shop` table
4. Click on the row for `testing-m2web.myshopify.com`
5. Click **Edit** button
6. Change `themeExtensionEnabled` from `0` to `1`
7. Click **Save**

### **Step 2: Alternative - Run SQL Command**
In PHPMyAdmin SQL tab, run:
```sql
UPDATE `Shop` 
SET `themeExtensionEnabled` = 1 
WHERE `shop` = 'testing-m2web.myshopify.com';
```

### **Step 3: Verify Update**
Run this query to check:
```sql
SELECT `shop`, `installed`, `themeExtensionEnabled` 
FROM `Shop` 
WHERE `shop` = 'testing-m2web.myshopify.com';
```

You should see `themeExtensionEnabled = 1`

## 🚀 **Test After Fix:**

### **1. Check Status API:**
Visit: `https://fomoapp.smartreminder.in/apps/fomo/status?shop=testing-m2web.myshopify.com`

Expected response:
```json
{
  "shop": "testing-m2web.myshopify.com",
  "themeExtensionEnabled": true,
  "installed": true,
  "hasAccessToken": true
}
```

### **2. Check Popup API:**
Visit: `https://fomoapp.smartreminder.in/apps/fomo/popup?shop=testing-m2web.myshopify.com`

### **3. Test Theme Extension:**
The theme extension should now work without "Session not ready" error.

## 🎯 **Quick Fix Commands:**

### **Option 1: Direct SQL Update**
```sql
UPDATE `Shop` SET `themeExtensionEnabled` = 1 WHERE `shop` = 'testing-m2web.myshopify.com';
```

### **Option 2: Use Admin Panel**
1. Go to: `https://fomoapp.smartreminder.in/app/theme-extension-toggle`
2. Click "Enable Theme Extension"

## ✅ **Expected Result:**
- `themeExtensionEnabled` should be `1` in database
- API endpoints should return `themeExtensionEnabled: true`
- Theme extension should load without session error
