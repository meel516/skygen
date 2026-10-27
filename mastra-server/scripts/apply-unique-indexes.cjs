const fs = require('fs');
const { Pool } = require('pg');
const TARGET = process.env.TARGET_DB;
if (!TARGET) throw new Error('TARGET_DB missing');
function withIfNotExists(sql) {
  return sql.replace(/^CREATE UNIQUE INDEX\s+/i, 'CREATE UNIQUE INDEX IF NOT EXISTS ');
}
const indexes = JSON.parse(fs.readFileSync('unique-indexes.json', 'utf8'));
const p = new Pool({ connectionString: TARGET, ssl: { rejectUnauthorized: false } });
(async () => {
  for (const idx of indexes) {
    const sql = withIfNotExists(idx.indexdef);
    process.stdout.write(`Creating ${idx.indexname}... `);
    await p.query(sql);
    console.log('ok');
  }
  await p.end();
  console.log(`Applied ${indexes.length} unique indexes.`);
})().catch(async e => { console.error(e); await p.end(); process.exit(1); });
