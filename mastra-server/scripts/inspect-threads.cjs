const { Pool } = require('pg');

const db = new Pool({
  connectionString: process.env.TARGET_DB,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  for (const table of ['mastra_threads', 'mastra_messages', 'users']) {
    const { rows } = await db.query(
      `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position
      `,
      [table],
    );
    console.log(`\n${table}`);
    for (const row of rows) console.log(`  ${row.column_name}: ${row.data_type}`);
  }

  const users = await db.query('SELECT id, email FROM users ORDER BY id LIMIT 5');
  console.log('\nusers sample');
  console.log(users.rows);

  const userId = users.rows[0]?.id;
  if (!userId) return;

  console.log(`\nthread list query for ${userId}`);
  const result = await db.query(
    `
    SELECT
      t.id,
      t.title,
      t.metadata,
      t."createdAt",
      t."createdAtZ",
      t."updatedAt",
      t."updatedAtZ",
      COUNT(m.id) AS "messageCount",
      lm.role AS "lastRole",
      lm.content AS "lastContent",
      COALESCE(lm."createdAtZ", lm."createdAt") AS "lastMessageAt"
    FROM mastra_threads t
    LEFT JOIN mastra_messages m
      ON m.thread_id = t.id
      AND m."resourceId" = t."resourceId"
      AND m.role IN ('user', 'assistant')
    LEFT JOIN LATERAL (
      SELECT role, content, "createdAt", "createdAtZ"
      FROM mastra_messages
      WHERE thread_id = t.id
        AND "resourceId" = t."resourceId"
        AND role IN ('user', 'assistant')
      ORDER BY COALESCE("createdAtZ", "createdAt") DESC
      LIMIT 1
    ) lm ON TRUE
    WHERE t."resourceId" = $1
      AND t.id LIKE 'chat-%'
    GROUP BY
      t.id,
      t.title,
      t.metadata,
      t."createdAt",
      t."createdAtZ",
      t."updatedAt",
      t."updatedAtZ",
      lm.role,
      lm.content,
      lm."createdAt",
      lm."createdAtZ"
    ORDER BY COALESCE(t."updatedAtZ", t."updatedAt", t."createdAtZ", t."createdAt") DESC
    LIMIT $2
    `,
    [userId, 50],
  );
  console.log(result.rows);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.end());
