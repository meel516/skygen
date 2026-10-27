const fs = require('fs');
const { Pool } = require('pg');
const SOURCE = process.env.SOURCE_DB;
const p = new Pool({ connectionString: SOURCE, ssl: { rejectUnauthorized: false } });
(async () => {
  const { rows } = await p.query(`
    SELECT schemaname, tablename, indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexdef ILIKE 'CREATE UNIQUE INDEX%'
    ORDER BY tablename, indexname
  `);
  fs.writeFileSync('unique-indexes.json', JSON.stringify(rows, null, 2));
  console.log(`Wrote ${rows.length} unique indexes`);
  for (const r of rows) console.log(`${r.tablename}: ${r.indexname}`);
  await p.end();
})().catch(async e => { console.error(e); await p.end(); process.exit(1); });
