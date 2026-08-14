// Test script for van_loads table
// Usage: SUPABASE_SERVICE_ROLE_KEY="..." node scripts/test-van-loads.js
// Key found at: Supabase Dashboard -> Project Settings -> API -> service_role key

const https = require('https');

const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_KEY) {
  console.error('Usage: SUPABASE_SERVICE_ROLE_KEY="..." node scripts/test-van-loads.js');
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
  console.log('=== van_loads table test ===\n');
  const today = new Date().toISOString().slice(0, 10);

  // 0. Fetch a real product to use
  console.log('0. Fetching a real product...');
  const prodRes = await req('GET', 'products?limit=1&is_active=eq.true');
  if (prodRes.status !== 200 || !prodRes.body[0]) { console.error('   No products found — add a product first.'); process.exit(1); }
  const testProductId = prodRes.body[0].id;
  const testProductName = prodRes.body[0].name;
  console.log(`   Using: "${testProductName}" (${testProductId})`);

  // 1. INSERT a load entry
  console.log('\n1. Inserting van load...');
  const insert = await req('POST', 'van_loads', {
    agent_name: 'Test Agent',
    load_date: today,
    product_id: testProductId,
    product_name: testProductName,
    quantity_loaded: 50,
  });
  console.log('   Status:', insert.status, insert.status === 201 ? '✅' : '❌');
  if (insert.status !== 201) { console.error('   Body:', insert.body); process.exit(1); }
  const id = insert.body[0]?.id;
  console.log('   ID:', id);

  // 2. READ back
  console.log('\n2. Reading back...');
  const read = await req('GET', `van_loads?agent_name=eq.Test+Agent&load_date=eq.${today}`);
  console.log('   Status:', read.status, read.status === 200 ? '✅' : '❌');
  console.log('   Row:', JSON.stringify(read.body[0]));

  // 3. UPSERT — same agent+date+product should update qty, not duplicate
  console.log('\n3. Upserting same row (should update quantity)...');
  const upsert = await req('POST', 'van_loads?on_conflict=agent_name,load_date,product_id', {
    agent_name: 'Test Agent',
    load_date: today,
    product_id: testProductId,
    product_name: testProductName,
    quantity_loaded: 75,
  }, { 'Prefer': 'resolution=merge-duplicates,return=representation' });
  console.log('   Status:', upsert.status, upsert.status === 200 || upsert.status === 201 ? '✅' : '❌');
  const countCheck = await req('GET', `van_loads?agent_name=eq.Test+Agent&load_date=eq.${today}`);
  console.log('   Row count (should be 1):', countCheck.body.length, countCheck.body.length === 1 ? '✅' : '❌ DUPLICATE!');
  console.log('   Updated qty (should be 75):', countCheck.body[0]?.quantity_loaded, countCheck.body[0]?.quantity_loaded === 75 ? '✅' : '❌');

  // 4. DELETE — clean up
  console.log('\n4. Cleaning up...');
  const del = await req('DELETE', `van_loads?agent_name=eq.Test+Agent&load_date=eq.${today}`);
  console.log('   Status:', del.status, del.status === 200 || del.status === 204 ? '✅' : '❌');

  console.log('\n✅ All tests passed — van_loads table is ready.');
}

run().catch(err => { console.error('Error:', err.message); process.exit(1); });
