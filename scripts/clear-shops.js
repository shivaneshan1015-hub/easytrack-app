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

async function clearShops() {
  console.log('🧹 Clearing old test shops and shop custom prices...\n');

  try {
    // 1. Clear shop custom prices
    const { error: priceErr } = await supabaseAdmin
      .from('shop_product_prices')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (priceErr && priceErr.code !== '42P01') {
      console.warn('Notice clearing shop_product_prices:', priceErr.message);
    } else {
      console.log('✅ Cleared table: shop_product_prices');
    }

    // 2. Clear shops table
    const { error: shopErr } = await supabaseAdmin
      .from('shops')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (shopErr) throw shopErr;
    console.log('✅ Cleared table: shops');

    console.log('\n🎉 All old test shop details have been completely removed!');

  } catch (err) {
    console.error('❌ Error clearing shops:', err.message);
  }
}

clearShops();
