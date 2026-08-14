// Applies any migrations/*.sql file not yet recorded in `_migrations_applied` to the
// live Supabase Postgres database, in filename order, each in its own transaction.
//
// Local usage:  node scripts/run-migrations.js "YOUR_DB_PASSWORD"
//   Password: Supabase Dashboard -> Project Settings -> Database -> Database Password
// CI/Vercel usage: set SUPABASE_DB_PASSWORD as an environment variable; this file is
//   invoked automatically as part of `npm run build` (see package.json).
//
// First run ever: no filename is yet recorded, so every existing file in migrations/
// is "baselined" (recorded as already-applied, NOT re-executed) rather than replayed,
// since those were already run manually in the past. Only files added after that point
// get executed.

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const password = process.argv[2] || process.env.SUPABASE_DB_PASSWORD;

if (!password) {
  if (process.env.VERCEL) {
    console.error('SUPABASE_DB_PASSWORD is not set in the Vercel environment — cannot run migrations. Add it under Project Settings -> Environment Variables.');
    process.exit(1);
  }
  console.log('No DB password provided (arg or SUPABASE_DB_PASSWORD env var) — skipping migrations for this local build.');
  console.log('Usage: node scripts/run-migrations.js "YOUR_DB_PASSWORD"');
  process.exit(0);
}

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

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
    create table if not exists _migrations_applied (
      filename   text primary key,
      applied_at timestamptz not null default now()
    )
  `);

  const { rows: appliedRows } = await client.query('select filename from _migrations_applied');
  const applied = new Set(appliedRows.map(r => r.filename));

  const allFiles = fs.readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort();

  if (applied.size === 0 && allFiles.length > 0) {
    console.log(`First run — baselining ${allFiles.length} existing migration file(s) as already applied (they were run manually before this tool existed).`);
    try {
      await client.query('BEGIN');
      for (const file of allFiles) {
        await client.query('insert into _migrations_applied (filename) values ($1)', [file]);
        console.log(`  baseline: ${file}`);
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
    console.log('Baseline complete. New migration files added after this point will run automatically.');
    await client.end();
    return;
  }

  const pending = allFiles.filter(f => !applied.has(f));

  if (pending.length === 0) {
    console.log('No pending migrations. Database is up to date.');
    await client.end();
    return;
  }

  console.log(`Found ${pending.length} pending migration(s): ${pending.join(', ')}`);

  for (const file of pending) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    console.log(`Applying ${file}...`);
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('insert into _migrations_applied (filename) values ($1)', [file]);
      await client.query('COMMIT');
      console.log(`  applied: ${file}`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`  FAILED: ${file} — ${err.message}`);
      console.error('Stopping — fix this migration before the next deploy.');
      await client.end();
      process.exit(1);
    }
  }

  console.log('All pending migrations applied.');
  await client.end();
}

run().catch(err => {
  console.error('Migration run failed:', err.message);
  client.end();
  process.exit(1);
});
