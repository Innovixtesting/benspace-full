
import { createServer } from 'node:http'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { demoSlots, providers, modes, demoCode } from '../src/data.js'
import { createDatabase } from './database.js'

const hash = token => createHash('sha256').update(token).digest('hex')

const allowedOrigins = new Set([
  ...[5173, 4173, 3001].flatMap(port =>
    ['localhost', '127.0.0.1'].map(host => `http://${host}:${port}`)
  ),
  ...(process.env.FRONTEND_ORIGINS || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean),
])

const languages = {
  maya: 'English, Hindi',
  aditi: 'English, Hindi',
  riya: 'English, Bengali',
  leela: 'English, Tamil',
  arun: 'English, Tamil',
}

const sessionCookie = (value, age) =>
  `benspace_session=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}`

async function jsonBody(req) {
  if (req.headers['content-type']?.split(';')[0] !== 'application/json') {
    throw Object.assign(new Error('Send JSON.'), { status: 415 })
  }

  const chunks = []
  let size = 0

  for await (const chunk of req) {
    size += chunk.length
    if (size <= 4096) chunks.push(chunk)
  }

  if (size > 4096) {
    throw Object.assign(new Error('Request is too large.'), { status: 413 })
  }

  try {
    const body = JSON.parse(Buffer.concat(chunks))

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new Error()
    }

    return body
  } catch {
    throw Object.assign(new Error('Enter a valid request.'), { status: 400 })
  }
}

export async function createApi(database = createDatabase()) {
  const query = async (text, params = []) => {
    const result = await database.query(text, params)
    return result.rows
  }

  const one = async (text, params = []) => {
    const rows = await query(text, params)
    return rows[0] ?? null
  }

  try {
    const schema = readFileSync(
      new URL('./schema.sql', import.meta.url),
      'utf8'
    )

    await database.exec(schema)

    for (const p of providers) {
      await query(
        `INSERT INTO providers
          (id, name, role, focus, bio, languages)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO NOTHING`,
        [p.id, p.name, p.role, p.focus, p.bio, languages[p.id]]
      )
    }
  } catch (error) {
    await database.close()
    throw error
  }

  async function seedSlots() {
    for (const p of providers) {
      for (const slot of demoSlots(p)) {
        await query(
          `INSERT INTO slots (id, provider_id, starts_at)
           VALUES ($1, $2, $3)
           ON CONFLICT (id) DO NOTHING`,
          [slot.id, p.id, slot.startsAt]
        )
      }
    }
  }

  const bookingQuery = `
    SELECT
      b.id,
      s.provider_id AS "providerId",
      b.slot_id AS "slotId",
      s.starts_at AS "startsAt",
      b.mode,
      b.note
    FROM bookings b
    JOIN slots s ON s.id = b.slot_id
  `

  const server = createServer(async (req, res) => {
    const send = (status, payload) => {
      res.writeHead(status, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      })
      res.end(JSON.stringify(payload))
    }

    const fail = (status, message) => send(status, { message })
    const method = req.method
    const route = new URL(req.url, 'http://localhost').pathname

    try {
      if (
        method !== 'GET' &&
        req.headers.origin &&
        !allowedOrigins.has(req.headers.origin)
      ) {
        return fail(403, 'Origin is unavailable.')
      }

      if (route === '/api/health' && method === 'GET') {
  try {
    await query('SELECT 1')
    return send(200, { ok: true, database: 'connected' })
  } catch {
    return send(503, { ok: false, database: 'unavailable' })
  }
}

      const token = /(?:^|;)benspace_session=([a-f0-9]{64})(?:;|$)/
        .exec(req.headers.cookie ?? '')?.[1]

      const session = token
        ? await one(
            `SELECT college_id
             FROM sessions
             WHERE token_hash = $1 AND expires_at > $2`,
            [hash(token), Date.now()]
          )
        : null

      const student = session?.college_id

      if (route === '/api/auth/verify' && method === 'POST') {
        const {
          collegeId,
          code,
          action,
          fullName,
          major,
          academicYear,
        } = await jsonBody(req)

        const id = typeof collegeId === 'string'
          ? collegeId.trim().toUpperCase()
          : ''

        if (!['signup', 'signin'].includes(action)) {
          return fail(400, 'Choose Sign up or Sign in.')
        }

        if (!/^[A-Z0-9][A-Z0-9-]{2,39}$/.test(id)) {
          return fail(400, 'Enter a valid college ID.')
        }

        if (code !== demoCode) {
          return fail(400, 'Check the demo verification code.')
        }

        const exists = await one(
          'SELECT 1 FROM students WHERE college_id = $1',
          [id]
        )

        if (action === 'signup') {
          const name = typeof fullName === 'string' ? fullName.trim() : ''
          const course = typeof major === 'string' ? major.trim() : ''
          const year = typeof academicYear === 'string'
            ? academicYear.trim()
            : ''

          if (name.length < 2 || name.length > 80) {
            return fail(422, 'Enter your full name (2â€“80 characters).')
          }

          if (course.length < 2 || course.length > 80) {
            return fail(422, 'Enter your course or programme.')
          }

          if (year.length < 2 || year.length > 40) {
            return fail(422, 'Enter your academic year.')
          }

          if (exists) {
            return fail(409, 'This college ID is already registered. Choose Sign in.')
          }

          try {
            await query(
              `INSERT INTO students
                (college_id, full_name, major, academic_year)
               VALUES ($1, $2, $3, $4)`,
              [id, name, course, year]
            )
          } catch (error) {
            if (error.code === '23505') {
              return fail(409, 'This college ID is already registered. Choose Sign in.')
            }
            throw error
          }
        }

        if (action === 'signin' && !exists) {
          return fail(
            404,
            'No account found. Choose Sign up to create a demo account.'
          )
        }

        if (token) {
          await query(
            'DELETE FROM sessions WHERE token_hash = $1',
            [hash(token)]
          )
        }

        await query(
          'DELETE FROM sessions WHERE expires_at <= $1',
          [Date.now()]
        )

        const next = randomBytes(32).toString('hex')

        await query(
          `INSERT INTO sessions (token_hash, college_id, expires_at)
           VALUES ($1, $2, $3)`,
          [hash(next), id, Date.now() + 28800000]
        )

        res.setHeader('Set-Cookie', sessionCookie(next, 28800))
        return send(200, { collegeId: id })
      }

      if (route === '/api/auth/logout' && method === 'POST') {
        if (token) {
          await query(
            'DELETE FROM sessions WHERE token_hash = $1',
            [hash(token)]
          )
        }

        res.setHeader('Set-Cookie', sessionCookie('', 0))
        return send(200, { ok: true })
      }

      if (!student) {
        return fail(401, 'Signin to continue.')
      }

      if (route === '/api/me' && method === 'GET') {
        const profile = await one(
          `SELECT
             college_id AS "collegeId",
             full_name AS "fullName",
             major,
             academic_year AS "academicYear"
           FROM students
           WHERE college_id = $1`,
          [student]
        )

        return send(200, profile)
      }

      if (route === '/api/directory' && method === 'GET') {
        await seedSlots()

        const providerRows = await query(
          'SELECT * FROM providers'
        )

        const providerOrder = new Map(
          providers.map((provider, index) => [provider.id, index])
        )

        providerRows.sort(
          (a, b) => providerOrder.get(a.id) - providerOrder.get(b.id)
        )

        const slots = await query(
          `SELECT
             s.id,
             s.provider_id AS "providerId",
             s.starts_at AS "startsAt",
             EXISTS (
               SELECT 1
               FROM bookings b
               WHERE b.slot_id = s.id
                 AND b.cancelled_at IS NULL
             ) AS taken
           FROM slots s
           WHERE s.starts_at > $1
           ORDER BY s.starts_at`,
          [new Date().toISOString()]
        )

        return send(200, {
          providers: providerRows,
          slots,
        })
      }

      if (route === '/api/bookings' && method === 'GET') {
        const bookings = await query(
          bookingQuery + `
            WHERE b.college_id = $1
              AND b.cancelled_at IS NULL
            ORDER BY s.starts_at`,
          [student]
        )

        return send(200, bookings)
      }

      const match = /^\/api\/bookings\/([\da-f-]+)$/.exec(route)
      const create = route === '/api/bookings' && method === 'POST'

      if (create || (match && ['PATCH', 'DELETE'].includes(method))) {
        const body = method === 'DELETE' ? null : await jsonBody(req)
        const id = create ? randomUUID() : match[1]

        const old = !create
          ? await one(
              bookingQuery + `
                WHERE b.id = $1
                  AND b.college_id = $2
                  AND b.cancelled_at IS NULL`,
              [id, student]
            )
          : null

        if (!create && !old) {
          return fail(404, 'Appointment not found.')
        }

        const now = new Date().toISOString()

        if (!create && old.startsAt <= now) {
          return fail(409, 'This appointment has already started.')
        }

        if (method === 'DELETE') {
          await query(
            'UPDATE bookings SET cancelled_at = $1 WHERE id = $2',
            [now, id]
          )

          return send(200, { ok: true })
        }

        if (
          typeof body.slotId !== 'string' ||
          !modes.includes(body.mode) ||
          typeof body.note !== 'string' ||
          body.note.length > 300
        ) {
          return fail(422, 'Check the mode, slot and note.')
        }

        const slot = await one(
          'SELECT * FROM slots WHERE id = $1 AND starts_at > $2',
          [body.slotId, now]
        )

        if (!slot || (!create && slot.provider_id !== old.providerId)) {
          return fail(409, 'That slot is no longer available.')
        }

        const overlap = await one(
          `SELECT 1
           FROM bookings b
           JOIN slots s ON s.id = b.slot_id
           WHERE b.college_id = $1
             AND b.id <> $2
             AND b.cancelled_at IS NULL
             AND s.starts_at = $3`,
          [student, id, slot.starts_at]
        )

        if (overlap) {
          return fail(409, 'You already have an appointment at that time.')
        }

        try {
          if (create) {
            await query(
              `INSERT INTO bookings
                (id, college_id, slot_id, mode, note)
               VALUES ($1, $2, $3, $4, $5)`,
              [id, student, slot.id, body.mode, body.note.trim()]
            )
          } else {
            await query(
              `UPDATE bookings
               SET slot_id = $1, mode = $2, note = $3
               WHERE id = $4`,
              [slot.id, body.mode, body.note.trim(), id]
            )
          }
        } catch (error) {
          if (error.code === '23505') {
            return fail(409, 'That slot was just taken. Choose another time.')
          }
          throw error
        }

        const booking = await one(
          bookingQuery + ' WHERE b.id = $1',
          [id]
        )

        return send(create ? 201 : 200, booking)
      }

      return fail(404, 'Page not found.')
    } catch (error) {
      if (!error.status) {
        console.error(error)
      }

      if (!res.headersSent) {
        fail(
          error.status ?? 500,
          error.status
            ? error.message
            : 'Something went wrong. Try again.'
        )
      }
    }
  })

  server.on('close', () => {
    void database.close().catch(error => {
      console.error('Database shutdown error:', error.message)
    })
  })

  return server
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const port = Number(process.env.PORT || 3001)

  const server = await createApi()

  server.listen(port, '0.0.0.0', () => {
    console.log(`BenSpace API listening on port ${port}`)
  })
}
