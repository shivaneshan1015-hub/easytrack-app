// One-off reconnaissance: dumps current RLS status + policies for every public table
// so migration 017 can be written against the DB's real state instead of guesses.
// Usage: node scripts/recon-rls.js "YOUR_DB_PASSWORD"
// Password: Supabase Dashboard -> Project Settings -> Database -> Database password
// Delete this file once migration 017 has been written and applied — it's a one-time tool.

const { Client } = require('pg');

const password = process.argv[2] || process.env.SUPABASE_DB_PASSWORD;
if (!password) {
  console.error('Usage: node scripts/recon-rls.js "YOUR_DB_PASSWORD"');
  process.exit(1);
}

const client = new Client({
  host: 'aws-1-ap-south-1.pooler.supabase.com',
  port: 5432,
  database: 'postgres',
  user: 'postgres.drfmdjmdtjhgayjeshvq',
  password,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  await client.connect();

  const { rows: tables } = await client.query(`
    select tablename, rowsecurity
    from pg_tables
    where schemaname = 'public'
    order by tablename
  `);
  console.log('\n=== TABLES: rowsecurity ===');
  for (const t of tables) console.log(`  ${t.rowsecurity ? '[RLS ON] ' : '[RLS OFF]'} ${t.tablename}`);

  const { rows: policies } = await client.query(`
    select schemaname, tablename, policyname, cmd, qual, with_check
    from pg_policies
    where schemaname in ('public', 'storage')
    order by tablename, cmd
  `);
  console.log('\n=== POLICIES ===');
  for (const p of policies) {
    console.log(`  ${p.schemaname}.${p.tablename} :: ${p.policyname} [${p.cmd}]`);
    console.log(`      USING: ${p.qual ?? '(none)'}`);
    console.log(`      WITH CHECK: ${p.with_check ?? '(none)'}`);
  }

  await client.end();
}

run().catch(err => { console.error('Recon query failed:', err.message); client.end(); process.exit(1); });
