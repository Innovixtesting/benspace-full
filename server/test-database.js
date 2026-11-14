
import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'

export async function createTestDatabase() {
  const db = new PGlite()

  const schema = await readFile(
    new URL('./schema.sql', import.meta.url),
    'utf8'
  )

  await db.exec(schema)

  return {
    query: (text, params = []) => db.query(text, params),
    exec: text => db.exec(text),
    close: () => db.close(),
  }
}
