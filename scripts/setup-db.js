import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';

if (!process.env.DATABASE_URL) {
  if (process.argv.includes('--optional')) {
    console.log('DATABASE_URL not set; skipping Supabase schema setup.');
    process.exit(0);
  }
  console.error('DATABASE_URL is required. Copy the Supabase connection string from Project → Connect.');
  process.exit(1);
}

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const sql = await readFile(path.join(root, 'db', 'schema.sql'), 'utf8');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
try {
  await pool.query(sql);
  const result = await pool.query("select to_regclass('vtime.staff_members') as table_name");
  if (result.rows[0]?.table_name !== 'vtime.staff_members') throw new Error('Table was not created');
  console.log('Supabase schema ready: vtime.staff_members');
} finally {
  await pool.end();
}
