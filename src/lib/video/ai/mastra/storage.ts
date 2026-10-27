import { PostgresStore } from '@mastra/pg';

export const storage = new PostgresStore({
  id: 'videogen',
  connectionString: process.env.DATABASE_URL || 'postgresql://build-placeholder:5432/db,
});
