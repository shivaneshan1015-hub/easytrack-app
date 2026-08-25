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

async function clearEmployees() {
  console.log('🧹 Clearing old test employees/agents directory...\n');

  try {
    const { error } = await supabaseAdmin
      .from('employees')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (error && error.code !== '42P01') {
      console.warn('Notice clearing employees table:', error.message);
    } else {
      console.log('✅ Cleared table: employees');
    }

    console.log('\n🎉 All old test agent/employee details have been completely removed!');

  } catch (err) {
    console.error('❌ Error clearing employees:', err.message);
  }
}

clearEmployees();
