import { PostgresStore } from '@mastra/pg';

export const storage = new PostgresStore({
  id: 'videogen',
  connectionString: process.env.DATABASE_URL!,
});
