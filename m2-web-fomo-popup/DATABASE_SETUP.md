# 🗄️ Database Setup Guide

## ✅ **Auto-Updated Environment Variables**

All database-related environment variables have been automatically configured in your code.

## 🚀 **Quick Setup Commands**

### **Option 1: Full Auto Setup**
```bash
npm run setup-full
```

### **Option 2: Manual Setup**
```bash
# 1. Setup environment variables
npm run setup-env

# 2. Generate Prisma client
npx prisma generate

# 3. Update database schema
npx prisma db push

# 4. Start your app
npm start
```

## 📋 **Environment Variables (Auto-Configured)**

Your `.env` file now includes:

```env
# Database Configuration
DATABASE_URL=mysql://m2websol_fomoapp:EKldCfhr441uw%25o%23@192.250.231.31:3306/m2websol_fomoapp
SHADOW_DATABASE_URL=mysql://m2websol_fomoapp:EKldCfhr441uw%25o%23@192.250.231.31:3306/m2websol_fomoapp

# Optional Database Settings
DATABASE_CONNECTION_LIMIT=10
DATABASE_TIMEOUT=30000
```

## 🔧 **Updated Files**

### **Database Configuration:**
- ✅ `prisma/schema.prisma` - Added shadowDatabaseUrl
- ✅ `app/db.server.js` - Enhanced with environment config
- ✅ `app/config/database.js` - New database config helper

### **Setup Scripts:**
- ✅ `scripts/setup-env.js` - Auto environment setup
- ✅ `package.json` - New setup commands
- ✅ `env.example` - Environment template

## 🎯 **New Database Features**

### **1. Theme Extension Control**
- Added `themeExtensionEnabled` field to Shop model
- Default: `false` (disabled)
- Control from admin panel: `/app/theme-extension-toggle`

### **2. Enhanced Connection Handling**
- Connection pool settings
- Error handling
- Environment-based configuration

### **3. Migration Support**
- Shadow database for safe migrations
- Auto-generated migrations
- Production-ready setup

## 🚨 **Troubleshooting**

### **If you get P3014 error:**
```bash
# Use db push instead of migrate
npx prisma db push --skip-generate
```

### **If database connection fails:**
1. Check your `.env` file has correct credentials
2. Verify database server is accessible
3. Check firewall settings

### **If shadow database error:**
The `SHADOW_DATABASE_URL` is now automatically configured to use the same database as your main connection.

## 🎉 **Ready to Go!**

Your database is now fully configured with:
- ✅ Environment variables auto-setup
- ✅ Theme extension control
- ✅ Enhanced error handling
- ✅ Production-ready configuration

Just run: `npm run setup-full` and you're done! 🚀
