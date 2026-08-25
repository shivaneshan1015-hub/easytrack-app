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

async function checkUsers() {
  const { data: profiles, error } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, email, role, created_at');

  console.log('📋 Current Registered Logins / Profiles in Database:');
  console.table(profiles || []);
}

checkUsers();
