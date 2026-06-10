// Test script for agent_expenses table
// Usage: node scripts/test-agent-expenses.js

const https = require('https');

const SUPABASE_URL = 'https://drfmdjmdtjhgayjeshvq.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRyZm1kam1kdGpoZ2F5amVzaHZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDE1OTgzMCwiZXhwIjoyMDk1NzM1ODMwfQ.l-LFydWINyxQJzAW2iOlnZaA19Riv8y-rqod1Eab72A';

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'drfmdjmdtjhgayjeshvq.supabase.co',
      path: `/rest/v1/${path}`,
      method,
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
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
  console.log('=== agent_expenses table test ===\n');

  // 1. INSERT a test expense
  console.log('1. Inserting test expense...');
  const insert = await req('POST', 'agent_expenses', {
    agent_name: 'Test Agent',
    category: 'Travel',
    amount: 250.00,
    note: 'Petrol for morning route',
    expense_date: new Date().toISOString().slice(0, 10),
    status: 'pending',
  });
  console.log('   Status:', insert.status, insert.status === 201 ? '✅' : '❌');
  if (insert.status !== 201) { console.error('   Body:', insert.body); process.exit(1); }
  const expenseId = insert.body[0]?.id;
  console.log('   Created ID:', expenseId);

  // 2. READ it back
  console.log('\n2. Reading back the expense...');
  const read = await req('GET', `agent_expenses?id=eq.${expenseId}`);
  console.log('   Status:', read.status, read.status === 200 ? '✅' : '❌');
  console.log('   Row:', JSON.stringify(read.body[0], null, 2));

  // 3. UPDATE status to approved
  console.log('\n3. Approving expense...');
  const update = await req('PATCH', `agent_expenses?id=eq.${expenseId}`, { status: 'approved' });
  console.log('   Status:', update.status, update.status === 200 ? '✅' : '❌');
  console.log('   Updated status:', update.body[0]?.status);

  // 4. DELETE the test row
  console.log('\n4. Cleaning up test row...');
  const del = await req('DELETE', `agent_expenses?id=eq.${expenseId}`);
  console.log('   Status:', del.status, del.status === 200 || del.status === 204 ? '✅' : '❌');

  console.log('\n✅ All tests passed — agent_expenses table is ready.');
}

run().catch(err => { console.error('Error:', err.message); process.exit(1); });
