
import { Pool } from 'pg'

export function createDatabase() {
  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    throw new Error('DATABASE_URL is required.')
  }

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: true },
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  })

  return {
    query: (text, params = []) => pool.query(text, params),
    exec: text => pool.query(text),
    close: () => pool.end(),
  }
}
