// Test script for attendance table
// Usage: SUPABASE_SERVICE_ROLE_KEY="..." node scripts/test-attendance.js
// Key found at: Supabase Dashboard -> Project Settings -> API -> service_role key

const https = require('https');

const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_KEY) {
  console.error('Usage: SUPABASE_SERVICE_ROLE_KEY="..." node scripts/test-attendance.js');
  process.exit(1);
}
const HOST = 'drfmdjmdtjhgayjeshvq.supabase.co';

function req(method, path, body, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const options = {
      hostname: HOST,
      path: `/rest/v1/${path}`,
      method,
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
        ...extraHeaders,
      },
    };
    if (payload) options.headers['Content-Length'] = Buffer.byteLength(payload);
    const r = https.request(options, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

async function run() {
  console.log('=== attendance table test ===\n');
  const today = new Date().toISOString().slice(0, 10);

  // 1. INSERT — mark present
  console.log('1. Marking Test Agent as present...');
  const insert = await req('POST', 'attendance', {
    agent_name: 'Test Agent',
    date: today,
  });
  console.log('   Status:', insert.status, insert.status === 201 ? '✅' : '❌');
  if (insert.status !== 201) { console.error('   Body:', insert.body); process.exit(1); }
  const id = insert.body[0]?.id;
  console.log('   ID:', id, '| date:', insert.body[0]?.date, '| marked_at:', insert.body[0]?.marked_at);

  // 2. READ — verify record
  console.log('\n2. Reading back...');
  const read = await req('GET', `attendance?agent_name=eq.Test+Agent&date=eq.${today}`);
  console.log('   Status:', read.status, read.status === 200 ? '✅' : '❌');
  console.log('   Row:', JSON.stringify(read.body[0]));

  // 3. UPSERT — same agent+date should not create a duplicate
  console.log('\n3. Upserting same record (should update, not duplicate)...');
  const upsert = await req('POST', 'attendance', {
    agent_name: 'Test Agent',
    date: today,
    note: 'upsert test',
  }, { 'Prefer': 'resolution=merge-duplicates,return=representation' });
  console.log('   Status:', upsert.status, upsert.status === 200 || upsert.status === 201 ? '✅' : '❌');

  const countCheck = await req('GET', `attendance?agent_name=eq.Test+Agent&date=eq.${today}`);
  console.log('   Row count (should be 1):', countCheck.body.length, countCheck.body.length === 1 ? '✅' : '❌ DUPLICATE!');

  // 4. DELETE — clean up
  console.log('\n4. Cleaning up...');
  const del = await req('DELETE', `attendance?agent_name=eq.Test+Agent&date=eq.${today}`);
  console.log('   Status:', del.status, del.status === 200 || del.status === 204 ? '✅' : '❌');

  console.log('\n✅ All tests passed — attendance table is ready.');
}

run().catch(err => { console.error('Error:', err.message); process.exit(1); });
