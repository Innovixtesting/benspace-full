import { createServer } from 'node:http'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { pathToFileURL } from 'node:url'
import { demoSlots, providers, modes, demoCode, demoID } from '../src/data.js'

const sampleIDs = new Set([demoID, 'BU-DEMO-002'])
const hash = token => createHash('sha256').update(token).digest('hex')
const allowedOrigins = new Set([5173,4173,3001].flatMap(port => ['localhost','127.0.0.1'].map(host => `http://${host}:${port}`)))
const languages = {maya:'English, Hindi', aditi:'English, Hindi', riya:'English, Bengali', leela:'English, Tamil', arun:'English, Tamil'}
const sessionCookie = (value, age) => `benspace_session=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}`

async function jsonBody(req) {
  if (req.headers['content-type']?.split(';')[0] !== 'application/json') throw Object.assign(new Error('Send JSON.'),{status:415})
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size <= 4096) chunks.push(chunk)
  }
  if (size > 4096) throw Object.assign(new Error('Request is too large.'),{status:413})
  try {
    const body = JSON.parse(Buffer.concat(chunks))
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error()
    return body
  } catch { throw Object.assign(new Error('Enter a valid request.'),{status:400}) }
}

export function createApi(path = 'var/benspace.sqlite') {
  if (path === 'var/benspace.sqlite') mkdirSync('var',{recursive:true})
  const db = new DatabaseSync(path)
  db.exec(readFileSync(new URL('./schema.sql', import.meta.url),'utf8'))
  const sql = (query, operation, ...params) => db.prepare(query)[operation](...params)
  for (const p of providers) {
    sql('INSERT OR IGNORE INTO providers VALUES (?,?,?,?,?,?)','run',p.id,p.name,p.role,p.focus,p.bio,languages[p.id])
  }
  function seedSlots() {
    for (const p of providers) {
      for (const slot of demoSlots(p)) sql('INSERT OR IGNORE INTO slots VALUES (?,?,?)','run',slot.id,p.id,slot.startsAt)
    }
  }
  const bookingQuery = `SELECT b.id, s.provider_id AS providerId, b.slot_id AS slotId,
    s.starts_at AS startsAt, b.mode, b.note FROM bookings b JOIN slots s ON s.id=b.slot_id`
  const server = createServer(async (req,res) => {
    const send = (status, payload) => {
      res.writeHead(status, {'Content-Type':'application/json','Cache-Control':'no-store'})
      res.end(JSON.stringify(payload))
    }
    const fail = (status,message) => send(status,{message})
    const method = req.method
    const route = new URL(req.url,'http://localhost').pathname
    try {
      if (method !== 'GET' && req.headers.origin && !allowedOrigins.has(req.headers.origin)) return fail(403,'Origin is unavailable.')
      const token = /(?:^|; )benspace_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie ?? '')?.[1]
      const student = token && sql('SELECT college_id FROM sessions WHERE token_hash=? AND expires_at>?','get',hash(token),Date.now())?.college_id
      if (route === '/api/health' && method === 'GET') return send(200,{ok:true})
      if (route === '/api/auth/verify' && method === 'POST') {
        const {collegeId, code, action} = await jsonBody(req)
        const id = typeof collegeId === 'string' ? collegeId.trim().toUpperCase() : ''
        if (!sampleIDs.has(id) || code !== demoCode || !['signup','signin'].includes(action)) return fail(400,'Check the sample college ID and verification code.')
        const exists = sql('SELECT 1 FROM students WHERE college_id=?','get',id)
        if (action === 'signup' && exists) return fail(409,'This sample ID is registered. Choose Sign in.')
        if (action === 'signin' && !exists) return fail(404,'Create a demo account first using Sign up.')
        if (action === 'signup') sql('INSERT INTO students(college_id) VALUES (?)','run',id)
        if (token) sql('DELETE FROM sessions WHERE token_hash=?','run',hash(token))
        sql('DELETE FROM sessions WHERE expires_at<=?','run',Date.now())
        const next = randomBytes(32).toString('hex')
        sql('INSERT INTO sessions VALUES (?,?,?)','run',hash(next),id,Date.now()+28800000)
        res.setHeader('Set-Cookie',sessionCookie(next,28800))
        return send(200,{collegeId:id})
      }
      if (route === '/api/auth/logout' && method === 'POST') {
        if (token) sql('DELETE FROM sessions WHERE token_hash=?','run',hash(token))
        res.setHeader('Set-Cookie',sessionCookie('',0))
        return send(200,{ok:true})
      }
      if (!student) return fail(401,'Sign in to continue.')
      if (route === '/api/me' && method === 'GET') return send(200,{collegeId:student})
      if (route === '/api/directory' && method === 'GET') {
        seedSlots()
        return send(200,{
          providers:sql('SELECT * FROM providers ORDER BY rowid','all'),
          slots:sql(`SELECT s.id,s.provider_id AS providerId,s.starts_at AS startsAt,
            EXISTS (SELECT 1 FROM bookings b WHERE b.slot_id=s.id AND b.cancelled_at IS NULL) AS taken
            FROM slots s WHERE s.starts_at>? ORDER BY s.starts_at`,'all',new Date().toISOString())
        })
      }
      if (route === '/api/bookings' && method === 'GET') return send(200,sql(bookingQuery+' WHERE b.college_id=? AND b.cancelled_at IS NULL ORDER BY s.starts_at','all',student))
      const match = /^\/api\/bookings\/([\da-f-]+)$/.exec(route)
      const create = route === '/api/bookings' && method === 'POST'
      if (create || (match && ['PATCH','DELETE'].includes(method))) {
        const body = method === 'DELETE' ? null : await jsonBody(req)
        const id = create ? randomUUID() : match[1]
        const old = !create && sql(bookingQuery+' WHERE b.id=? AND b.college_id=? AND b.cancelled_at IS NULL','get',id,student)
        if (!create && !old) return fail(404,'Appointment not found.')
        const now = new Date().toISOString()
        if (!create && old.startsAt <= now) return fail(409,'This appointment has already started.')
        if (method === 'DELETE') {
          sql('UPDATE bookings SET cancelled_at=? WHERE id=?','run',now,id)
          return send(200,{ok:true})
        }
        if (typeof body.slotId !== 'string' || !modes.includes(body.mode) || typeof body.note !== 'string' || body.note.length > 300) return fail(422,'Check the mode, slot and note.')
        const slot = sql('SELECT * FROM slots WHERE id=? AND starts_at>?','get',body.slotId,now)
        if (!slot || (!create && slot.provider_id !== old.providerId)) return fail(409,'That slot is no longer available.')
        const overlap = sql(`SELECT 1 FROM bookings b JOIN slots s ON s.id=b.slot_id
          WHERE b.college_id=? AND b.id<>? AND b.cancelled_at IS NULL AND s.starts_at=?`,'get',student,id,slot.starts_at)
        if (overlap) return fail(409,'You already have an appointment at that time.')
        try {
          if (create) sql('INSERT INTO bookings(id,college_id,slot_id,mode,note) VALUES (?,?,?,?,?)','run',id,student,slot.id,body.mode,body.note.trim())
          else sql('UPDATE bookings SET slot_id=?,mode=?,note=? WHERE id=?','run',slot.id,body.mode,body.note.trim(),id)
        } catch (error) {
          if (error.errcode === 2067) return fail(409,'That slot was just taken. Choose another time.')
          throw error
        }
        return send(create ? 201 : 200,sql(bookingQuery+' WHERE b.id=?','get',id))
      }
      return fail(404,'Page not found.')
    } catch (error) {
      if (!error.status) console.error(error.message)
      if (!res.headersSent) fail(error.status ?? 500,error.status ? error.message : 'Something went wrong. Try again.')
    }
  })
  server.on('close',() => db.close())
  return server
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  createApi().listen(3001,'127.0.0.1',()=>console.log('BenSpace demo API at http://127.0.0.1:3001'))
}
