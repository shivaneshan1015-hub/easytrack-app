const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read .env.local manually
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf8');
  envConfig.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
      process.env[key.trim()] = value.trim();
    }
  });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://drfmdjmdtjhgayjeshvq.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false }
});

async function clearProducts() {
  console.log('🧹 Clearing old dummy products catalog from database...\n');

  try {
    const { error } = await supabaseAdmin
      .from('products')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (error && error.code !== '42P01') {
      console.warn('Notice clearing products table:', error.message);
    } else {
      console.log('✅ Cleared table: products');
    }

    console.log('\n🎉 All old dummy product catalog data has been completely removed!');

  } catch (err) {
    console.error('❌ Error clearing products:', err.message);
  }
}

clearProducts();
