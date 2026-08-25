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

// Emails to preserve (Super Admin creator account)
const PRESERVED_EMAILS = ['shivaneshan1015@gmail.com'];

async function deleteTestUsers() {
  console.log('🧹 Cleaning up old test logins (keeping Super Admin creator account)...\n');

  const { data: profiles } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, email, role');

  for (const user of profiles || []) {
    if (PRESERVED_EMAILS.includes(user.email) || user.role === 'super_admin') {
      console.log(`🛡️ Preserved Super Admin Creator Account: ${user.email} (${user.full_name})`);
    } else {
      try {
        // Delete profile row
        await supabaseAdmin.from('profiles').delete().eq('id', user.id);
        // Delete auth user from Supabase Auth
        await supabaseAdmin.auth.admin.deleteUser(user.id);
        console.log(`🗑️ Deleted old test login: ${user.email} (${user.full_name} - ${user.role})`);
      } catch (err) {
        console.warn(`Notice deleting ${user.email}:`, err.message);
      }
    }
  }

  console.log('\n✨ All old test agent and dispatcher logins have been removed.');
  console.log('Only your Super Admin creator account remains.');
}

deleteTestUsers();
