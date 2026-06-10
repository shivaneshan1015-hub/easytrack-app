// One-time migration: create agent_targets table
// Usage: node scripts/migrate-agent-targets.js "YOUR_DB_PASSWORD"
// Password found at: Supabase Dashboard → Project Settings → Database → Database Password

const { Client } = require('pg');

const password = process.argv[2];
if (!password) {
  console.error('Usage: node scripts/migrate-agent-targets.js "YOUR_DB_PASSWORD"');
  process.exit(1);
}

const client = new Client({
  host: 'db.drfmdjmdtjhgayjeshvq.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  await client.connect();
  console.log('Connected to Supabase PostgreSQL');

  await client.query(`
    create table if not exists agent_targets (
      id uuid default gen_random_uuid() primary key,
      agent_name text not null,
      month text not null,
      sales_target numeric default 0,
      collection_target numeric default 0,
      created_at timestamptz default now(),
      unique(agent_name, month)
    )
  `);
  console.log('✅ agent_targets table created (or already existed)');

  // Verify
  const { rows } = await client.query(`
    select column_name, data_type
    from information_schema.columns
    where table_name = 'agent_targets'
    order by ordinal_position
  `);
  console.log('Columns:', rows.map(r => `${r.column_name} (${r.data_type})`).join(', '));

  await client.end();
  console.log('Done.');
}

run().catch(err => { console.error('Migration failed:', err.message); client.end(); process.exit(1); });
