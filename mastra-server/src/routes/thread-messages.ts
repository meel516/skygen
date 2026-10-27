import type { Context } from 'hono';
import { getSessionFromRequest } from '../lib/auth';
import { storage } from '../../../src/lib/video/ai/mastra/storage';

function extractText(content: unknown): string {
  if (!content) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map(extractText).filter(Boolean).join('\n').trim();
  }
  if (typeof content !== 'object') return String(content);

  const record = content as Record<string, unknown>;
  if (typeof record.text === 'string') return record.text;
  if (typeof record.content === 'string') return record.content;
  if (Array.isArray(record.content)) return extractText(record.content);
  if (Array.isArray(record.parts)) return extractText(record.parts);
  return '';
}

function isPublicChatRole(role: string): role is 'user' | 'assistant' {
  return role === 'user' || role === 'assistant';
}

export async function threadMessagesHandler(c: Context) {
  const session = await getSessionFromRequest(c.req.raw);
  if (!session) return c.json({ error: 'Authentication required' }, 401);

  const userId = session.user.id;
  const threadId = c.req.param('threadId');
  const memoryStore = await storage.getStore('memory');

  if (!memoryStore) {
    return c.json({ error: 'Memory storage is unavailable' }, 500);
  }

  const thread = await memoryStore.getThreadById({ threadId });
  if (!thread || thread.resourceId !== userId) {
    return c.json({ error: 'Thread not found' }, 404);
  }

  const result = await memoryStore.listMessages({
    threadId,
    resourceId: userId,
    perPage: false,
    orderBy: { field: 'createdAt', direction: 'ASC' },
  });

  const messages = result.messages
    .filter((message) => isPublicChatRole(message.role))
    .map((message) => ({
      id: message.id,
      role: message.role,
      content: extractText(message.content),
      timestamp: new Date(message.createdAt).getTime(),
    }))
    .filter((message) => message.content.trim().length > 0)
    .filter((message) => !message.content.startsWith('[SYSTEM CONTEXT'));

  return c.json({
    thread: {
      id: thread.id,
      title: thread.title ?? null,
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
    },
    messages,
  });
}
