import { Pool } from 'pg'

const globalPool = globalThis as unknown as { pool: Pool | undefined }

const pool = globalPool.pool ?? new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
})

if (process.env.NODE_ENV !== 'production') globalPool.pool = pool

export const db = {
  query: async (text: string, params?: any[]) => {
    const client = await pool.connect()
    try {
      return await client.query(text, params)
    } finally {
      client.release()
    }
  }
}
