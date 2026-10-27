import type { Context } from 'hono';
import { getSessionFromRequest } from '../lib/auth';
import { db } from '../lib/db';

type ThreadRow = {
  id: string;
  title: string | null;
  metadata: Record<string, unknown> | string | null;
  createdAt: Date | string | null;
  createdAtZ: Date | string | null;
  updatedAt: Date | string | null;
  updatedAtZ: Date | string | null;
  messageCount: string | number | null;
  lastRole: string | null;
  lastContent: unknown;
  lastMessageAt: Date | string | null;
  jobStatus: string | null;
  activeRun: Record<string, unknown> | null;
};

function toIso(value: Date | string | null): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  return Number.isFinite(time) ? date.toISOString() : null;
}

function parseMetadata(value: ThreadRow['metadata']): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }
  return value;
}

function extractText(content: unknown): string {
  if (!content) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map(extractText).filter(Boolean).join(' ').trim();
  }
  if (typeof content !== 'object') return String(content);

  const record = content as Record<string, unknown>;
  if (typeof record.text === 'string') return record.text;
  if (typeof record.content === 'string') return record.content;
  if (Array.isArray(record.content)) return extractText(record.content);
  if (Array.isArray(record.parts)) return extractText(record.parts);
  return '';
}

function buildTitle(row: ThreadRow): string {
  if (row.title?.trim()) return row.title.trim();

  const metadata = parseMetadata(row.metadata);
  const workingMemory = typeof metadata.workingMemory === 'string' ? metadata.workingMemory : '';
  const currentGoal = workingMemory.match(/- Current Goal:\s*(.+)/)?.[1]?.trim();
  if (currentGoal) return currentGoal.slice(0, 80);

  const lastText = extractText(row.lastContent).replace(/\s+/g, ' ').trim();
  return lastText ? lastText.slice(0, 80) : 'Untitled conversation';
}

export async function threadsListHandler(c: Context) {
  try {
    const session = await getSessionFromRequest(c.req.raw);
    if (!session) return c.json({ error: 'Authentication required' }, 401);

    const userId = session.user.id;
    const limit = Math.min(Math.max(Number(c.req.query('limit') ?? 50), 1), 100);

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
      COALESCE(lm."createdAtZ", lm."createdAt") AS "lastMessageAt",
      j.status AS "jobStatus",
      j.state->'activeRun' AS "activeRun"
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
    LEFT JOIN wizard_jobs j
      ON j.thread_id = t.id
      AND j.user_id = t."resourceId"
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
      lm."createdAtZ",
      j.status,
      j.state
    ORDER BY COALESCE(t."updatedAtZ", t."updatedAt", t."createdAtZ", t."createdAt") DESC
    LIMIT $2
    `,
      [userId, limit],
    );

    const threads = (result.rows as ThreadRow[]).map((row) => ({
      id: row.id,
      title: buildTitle(row),
      messageCount: Number(row.messageCount ?? 0),
      lastRole: row.lastRole,
      lastMessage: extractText(row.lastContent).replace(/\s+/g, ' ').trim().slice(0, 140),
      createdAt: toIso(row.createdAtZ ?? row.createdAt),
      updatedAt: toIso(row.updatedAtZ ?? row.updatedAt ?? row.createdAtZ ?? row.createdAt),
      lastMessageAt: toIso(row.lastMessageAt),
      jobStatus: row.jobStatus,
      activeRun: row.activeRun,
    }));

    return c.json({ threads });
  } catch (error) {
    console.error('[threadsListHandler] failed:', error);
    return c.json({ error: 'Failed to list threads' }, 500);
  }
}
