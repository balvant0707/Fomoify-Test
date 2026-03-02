# 🚀 Plesk Server Deployment Guide

## 📋 **Files to Upload to Plesk Server:**

### **1. Database Files (Required):**
```
✅ prisma/schema.prisma
✅ app/db.server.js
✅ app/config/database.js (new file)
✅ scripts/setup-env.js (new file)
```

### **2. App Routes (Required):**
```
✅ app/routes/proxy.fomo.$subpath.jsx
✅ app/routes/app.theme-extension-toggle.jsx
✅ app/routes/app.jsx
✅ app/routes/app.theme-embed.jsx
```

### **3. Theme Extension (Required):**
```
✅ extensions/fomo-popup/assets/m2fomo-simple.js
```

### **4. Configuration Files (Required):**
```
✅ package.json
✅ .env (update with SHADOW_DATABASE_URL)
```

## 🔧 **Plesk Server Steps:**

### **Step 1: Update .env File in Plesk**
Add this line to your existing `.env` file:
```env
SHADOW_DATABASE_URL=mysql://m2websol_fomoapp:EKldCfhr441uw%25o%23@192.250.231.31:3306/m2websol_fomoapp
```

### **Step 2: Upload Files via Plesk File Manager**
1. Login to Plesk Panel
2. Go to **Files** → **File Manager**
3. Navigate to your domain folder
4. Upload all the files listed above

### **Step 3: Run Commands in Plesk Terminal**
1. Go to **Tools & Settings** → **Terminal**
2. Navigate to your project directory:
```bash
cd /var/www/vhosts/your-domain.com/httpdocs
```

3. Run these commands:
```bash
# Install dependencies (if needed)
npm install

# Generate Prisma client
npx prisma generate

# Update database schema
npx prisma db push

# Restart your application
npm restart
```

## 🎯 **Alternative: Direct Database Update**

If you can't run Prisma commands, manually add the field to your database:

### **MySQL Command:**
```sql
ALTER TABLE `Shop` ADD COLUMN `themeExtensionEnabled` BOOLEAN NOT NULL DEFAULT false;
```

## 📱 **Test Your Deployment:**

### **1. Check Admin Panel:**
Visit: `https://fomoapp.smartreminder.in/app/theme-extension-toggle`

### **2. Test API Endpoints:**
- Status: `https://fomoapp.smartreminder.in/apps/fomo/status?shop=your-shop`
- Popup: `https://fomoapp.smartreminder.in/apps/fomo/popup?shop=your-shop`

## 🚨 **If You Can't Access Terminal:**

### **Option 1: Manual Database Update**
Add this field to your `Shop` table:
```sql
themeExtensionEnabled BOOLEAN DEFAULT false
```

### **Option 2: Contact Your Hosting Provider**
Ask them to run:
```bash
npx prisma db push
```

## ✅ **Quick Checklist:**

- [ ] Upload all files to Plesk
- [ ] Update .env file with SHADOW_DATABASE_URL
- [ ] Run database migration (or manual SQL)
- [ ] Test admin panel
- [ ] Test API endpoints
- [ ] Verify theme extension works

## 🎉 **You're Done!**

Your theme extension backend control is now deployed on Plesk server!
