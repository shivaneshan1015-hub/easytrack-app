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

if (!serviceRoleKey) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false }
});

const TRANSACTIONAL_TABLES = [
  'transaction_items',
  'bill_payments',
  'return_items',
  'returns',
  'transactions',
  'agent_expenses',
  'shop_visits',
  'attendance',
  'leaves',
  'van_loads',
  'agent_targets'
];

async function clearData() {
  console.log('🧹 Starting cleanup of old test data...\n');

  for (const table of TRANSACTIONAL_TABLES) {
    try {
      const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error && error.code !== '42P01') {
        console.warn(`⚠️ Warning deleting from ${table}:`, error.message);
      } else {
        console.log(`✅ Cleared table: ${table}`);
      }
    } catch (err) {
      console.error(`❌ Failed clearing ${table}:`, err.message);
    }
  }

  console.log('\n🎉 Cleanup complete! All old test transactions, collections, returns, expenses, and logs have been deleted.');
  console.log('Master data (Shops, Product Catalog, Users, Invoice Settings) remains intact.');
}

clearData();
