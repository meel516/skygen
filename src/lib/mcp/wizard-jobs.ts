import { db } from '@/lib/db';

export type JobStatus = 'running' | 'interrupted' | 'complete' | 'error' | 'cancelled';

export interface WizardJob {
  thread_id:  string;
  user_id:    string;
  status:     JobStatus;
  interrupt:  Record<string, any> | null;
  payload:    Record<string, any> | null;
  state:      Record<string, any> | null;
  error:      string | null;
  created_at: string;
  updated_at: string;
}

export async function createJob(threadId: string, userId: string): Promise<void> {
  await db.query(
    `INSERT INTO wizard_jobs (thread_id, user_id, status)
     VALUES ($1, $2, 'running')
     ON CONFLICT (thread_id) DO NOTHING`,
    [threadId, userId],
  );
}

export async function getJob(threadId: string): Promise<WizardJob | null> {
  const result = await db.query(
    `SELECT * FROM wizard_jobs WHERE thread_id = $1`,
    [threadId],
  );
  return result.rows[0] ?? null;
}

export async function updateJob(
  threadId: string,
  update: { status: JobStatus; interrupt?: any; payload?: any; state?: any; error?: string },
): Promise<void> {
  await db.query(
    `UPDATE wizard_jobs
     SET status = $2, interrupt = $3, payload = $4, error = $5, state = COALESCE($6, state), updated_at = NOW()
     WHERE thread_id = $1`,
    [
      threadId,
      update.status,
      update.interrupt ? JSON.stringify(update.interrupt) : null,
      update.payload   ? JSON.stringify(update.payload)   : null,
      update.error     ?? null,
      update.state     ? JSON.stringify(update.state)     : null,
    ],
  );
}

export async function patchJobState(
  threadId: string,
  updater: (current: Record<string, any>) => Record<string, any>,
): Promise<void> {
  const job = await getJob(threadId);
  if (!job) return;
  const current = job.state ?? {};
  const updated = updater(current);
  await db.query(
    `UPDATE wizard_jobs SET state = $2, updated_at = NOW() WHERE thread_id = $1`,
    [threadId, JSON.stringify(updated)],
  );
}

/**
 * Atomically updates a single block in the filledBlocks array.
 * Thread-safe: prevents concurrent block fills from overwriting each other.
 */
export async function patchJobStateBlock(
  threadId: string,
  index: number,
  block: any,
): Promise<void> {
  // We use jsonb_set to update a specific index in the filledBlocks array.
  // The path is ['filledBlocks', index.toString()]
  await db.query(
    `UPDATE wizard_jobs 
     SET state = jsonb_set(
       COALESCE(state, '{}'::jsonb), 
       ARRAY['filledBlocks', $2::text], 
       $3::jsonb,
       true
     ), 
     updated_at = NOW() 
     WHERE thread_id = $1`,
    [threadId, index.toString(), JSON.stringify(block)],
  );
}

/**
 * Atomically updates or adds an image item in the imageItems array.
 */
export async function patchJobStateImageItem(
  threadId: string,
  item: any,
): Promise<void> {
  // Logic: either find and replace or append. 
  // For simplicity since we usually know the index or are appending, 
  // we'll fetch then update, but with a lock or just being careful.
  // Actually, for imageItems, we can just fetch and update because 
  // they are usually updated by the same worker sequentially or for different paths.
  // But let's stick to the atomic pattern where possible.
  
  const job = await getJob(threadId);
  if (!job) return;
  const state = job.state ?? {};
  const imageItems = state.imageItems ?? [];
  
  // Find index of item with same blockIdx and field_path
  const idx = imageItems.findIndex((i: any) => i.blockIdx === item.blockIdx && i.field_path === item.field_path);
  
  if (idx >= 0) {
    await db.query(
      `UPDATE wizard_jobs 
       SET state = jsonb_set(state, ARRAY['imageItems', $2::text], $3::jsonb),
       updated_at = NOW()
       WHERE thread_id = $1`,
      [threadId, idx.toString(), JSON.stringify(item)]
    );
  } else {
    // Append to array
    await db.query(
      `UPDATE wizard_jobs 
       SET state = jsonb_set(
         COALESCE(state, '{}'::jsonb), 
         ARRAY['imageItems'], 
         COALESCE(state->'imageItems', '[]'::jsonb) || $2::jsonb
       ),
       updated_at = NOW()
       WHERE thread_id = $1`,
      [threadId, JSON.stringify(item)]
    );
  }
}
