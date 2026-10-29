// CO3: Postgres integration with startup retry
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
async function init(sql, tries = 20) {
  for (let i = 0; i < tries; i++) {
    try { await pool.query(sql); return; }
    catch (e) { console.log(`DB not ready (${e.message}), retrying...`); await new Promise((r) => setTimeout(r, 2000)); }
  }
  throw new Error('database unavailable');
}
module.exports = { pool, init };
