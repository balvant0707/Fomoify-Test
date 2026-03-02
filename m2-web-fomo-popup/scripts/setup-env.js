#!/usr/bin/env node

// scripts/setup-env.js
const fs = require('fs');
const path = require('path');

const envTemplate = `# Shopify App Configuration
SHOPIFY_APP_URL=https://fomoapp.smartreminder.in
APP_URL=https://fomoapp.smartreminder.in
SHOPIFY_API_KEY=19bf03bfbf8995bb1bb05e7a45b1b062
SHOPIFY_API_SECRET=5fc59e35f59dc796194134765258fdfd
SCOPES=read_products,write_products,read_themes,write_themes,read_script_tags,write_script_tags,read_customers,write_customers,read_orders,write_orders

# Database Configuration
DATABASE_URL=mysql://m2websol_fomoapp:EKldCfhr441uw%25o%23@192.250.231.31:3306/m2websol_fomoapp
SHADOW_DATABASE_URL=mysql://m2websol_fomoapp:EKldCfhr441uw%25o%23@192.250.231.31:3306/m2websol_fomoapp

# Database Connection Pool Settings (Optional)
DATABASE_CONNECTION_LIMIT=10
DATABASE_TIMEOUT=30000

# Session Configuration
SESSION_SECRET=8df9a3e8c1b9f45a87f63a91c4d35b27d8e6d78e3d8e9a4a1f4e3b2c6f2a7c

# Environment
NODE_ENV=production

# Additional Database Settings (Optional)
# DB_HOST=192.250.231.31
# DB_PORT=3306
# DB_NAME=m2websol_fomoapp
# DB_USER=m2websol_fomoapp
# DB_PASSWORD=EKldCfhr441uw%o#
`;

function setupEnvironment() {
  const envPath = path.join(process.cwd(), '.env');
  
  // Check if .env already exists
  if (fs.existsSync(envPath)) {
    console.log('✅ .env file already exists');
    
    // Read current .env content
    const currentEnv = fs.readFileSync(envPath, 'utf8');
    
    // Check if SHADOW_DATABASE_URL exists
    if (!currentEnv.includes('SHADOW_DATABASE_URL')) {
      console.log('⚠️  Adding SHADOW_DATABASE_URL to existing .env file...');
      
      const updatedEnv = currentEnv + '\nSHADOW_DATABASE_URL=mysql://m2websol_fomoapp:EKldCfhr441uw%25o%23@192.250.231.31:3306/m2websol_fomoapp\n';
      fs.writeFileSync(envPath, updatedEnv);
      console.log('✅ SHADOW_DATABASE_URL added to .env');
    } else {
      console.log('✅ SHADOW_DATABASE_URL already exists in .env');
    }
  } else {
    console.log('📝 Creating new .env file...');
    fs.writeFileSync(envPath, envTemplate);
    console.log('✅ .env file created successfully');
  }
  
  console.log('\n🚀 Environment setup complete!');
  console.log('\n📋 Next steps:');
  console.log('1. Run: npx prisma generate');
  console.log('2. Run: npx prisma db push');
  console.log('3. Run: npm start');
}

// Run setup
setupEnvironment();
