import { NextResponse } from 'next/server';
import { Pool } from 'pg';
import { requireAuthenticatedSession } from '@/lib/api-security';

/**
 * GET /api/db/cleanup
 * Purges old LangGraph checkpoint data to free up storage.
 * PostgresSaver creates these tables: checkpoints, checkpoint_writes, checkpoint_blobs
 * Old wizard sessions accumulate large state (base64 audio, images) that bloat storage.
 */
export async function GET(req: Request) {
  const authResult = await requireAuthenticatedSession({ admin: true });
  if ('response' in authResult) {
    return authResult.response;
  }

  const { searchParams } = new URL(req.url);
  const daysOld = parseInt(searchParams.get('days') || '3', 10);
  const dryRun = searchParams.get('dry') === 'true';

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    // Check table sizes first
    const sizeResult = await pool.query(`
      SELECT
        tablename,
        pg_size_pretty(pg_total_relation_size(quote_ident(tablename))) AS size,
        pg_total_relation_size(quote_ident(tablename)) AS bytes
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename IN ('checkpoints', 'checkpoint_writes', 'checkpoint_blobs')
      ORDER BY bytes DESC
    `);

    const sizes = sizeResult.rows;

    // Count rows to be deleted
    const countResult = await pool.query(`
      SELECT COUNT(*) AS count FROM checkpoints
      WHERE (metadata::jsonb->>'created_at')::timestamp < NOW() - INTERVAL '${daysOld} days'
    `).catch(() => ({ rows: [{ count: '0' }] }));

    // Also count by checking thread_id patterns — older threads
    const threadCount = await pool.query(`
      SELECT COUNT(DISTINCT thread_id) AS count FROM checkpoints
    `).catch(() => ({ rows: [{ count: '0' }] }));

    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        tables: sizes,
        totalThreads: threadCount.rows[0]?.count,
        staleRows: countResult.rows[0]?.count,
        message: `Would delete checkpoints older than ${daysOld} days. Add ?dry=false to execute.`,
      });
    }

    // Delete old checkpoint data
    // checkpoint_writes and checkpoint_blobs reference checkpoints via thread_id
    const deleted = await pool.query(`
      WITH old_threads AS (
        SELECT DISTINCT thread_id FROM checkpoints
        WHERE (metadata::jsonb->>'created_at')::timestamp < NOW() - INTERVAL '${daysOld} days'
      )
      DELETE FROM checkpoints WHERE thread_id IN (SELECT thread_id FROM old_threads)
      RETURNING thread_id
    `).catch(async () => {
      // Fallback: if metadata doesn't have created_at, delete all but the most recent N threads
      const result = await pool.query(`
        WITH ranked AS (
          SELECT thread_id, ROW_NUMBER() OVER (ORDER BY checkpoint_id DESC) AS rn
          FROM checkpoints
        ),
        keep AS (
          SELECT DISTINCT thread_id FROM ranked WHERE rn <= 20
        )
        DELETE FROM checkpoints WHERE thread_id NOT IN (SELECT thread_id FROM keep)
        RETURNING thread_id
      `);
      return result;
    });

    // Clean up orphaned writes and blobs
    await pool.query(`
      DELETE FROM checkpoint_writes
      WHERE thread_id NOT IN (SELECT DISTINCT thread_id FROM checkpoints)
    `).catch(() => {});

    await pool.query(`
      DELETE FROM checkpoint_blobs
      WHERE thread_id NOT IN (SELECT DISTINCT thread_id FROM checkpoints)
    `).catch(() => {});

    // Re-check sizes after cleanup
    const afterSizes = await pool.query(`
      SELECT
        tablename,
        pg_size_pretty(pg_total_relation_size(quote_ident(tablename))) AS size
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename IN ('checkpoints', 'checkpoint_writes', 'checkpoint_blobs')
    `);

    return NextResponse.json({
      success: true,
      deletedThreads: deleted.rowCount,
      before: sizes,
      after: afterSizes.rows,
      message: `Cleaned up checkpoints older than ${daysOld} days`,
    });
  } catch (e: any) {
    console.error('[db/cleanup]', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  } finally {
    await pool.end();
  }
}
