
import assert from 'node:assert/strict'
import { once } from 'node:events'
import test from 'node:test'
import { createApi } from './index.js'
import { createTestDatabase } from './test-database.js'
import { dailyQuote } from '../src/data.js'

test('two accounts can book, reschedule and cancel without accessing each other’s appointments', async () => {
  const database = await createTestDatabase()
  const server = await createApi(database)

  server.listen(0, '127.0.0.1')
  await once(server, 'listening')

  const base = 'http://127.0.0.1:' + server.address().port + '/api'

  const request = (path, method = 'GET', body, cookie) =>
    fetch(base + path, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: body && JSON.stringify(body),
    })

  const verify = (collegeId, action = 'signup', code = '246810') =>
    request('/auth/verify', 'POST', {
      collegeId,
      action,
      code,
      ...(action === 'signup'
        ? {
            fullName: 'Test Student',
            major: 'Computer Science',
            academicYear: 'Year 2',
          }
        : {}),
    })

  try {
    assert.equal((await request('/bookings')).status, 401)
    assert.equal((await verify('BU-DEMO-001', 'signup', '000000')).status, 400)

    const auth = await verify('BU-DEMO-001')
    assert.equal(auth.status, 200)

    const one = auth.headers.get('set-cookie').split(';')[0]

    assert.equal((await verify('BU-DEMO-001')).status, 409)

    const other = await verify('BU-DEMO-002')
    assert.equal(other.status, 200)

    const two = other.headers.get('set-cookie').split(';')[0]

    const directory = await (
      await request('/directory', 'GET', undefined, one)
    ).json()

    const [first, second] = directory.slots.filter(
      slot => slot.providerId === 'riya'
    )

    assert.ok(first, 'Expected a first available Riya slot')
    assert.ok(second, 'Expected a second available Riya slot')

    const data = {
      slotId: first.id,
      mode: 'Video',
      note: 'Sample',
    }

    const booked = await request('/bookings', 'POST', data, one)
    assert.equal(booked.status, 201)

    const { id } = await booked.json()

    assert.equal((await request('/bookings', 'POST', data, two)).status, 409)

    assert.equal(
      (await request('/bookings/' + id, 'DELETE', undefined, two)).status,
      404
    )

    assert.deepEqual(
      await (await request('/bookings', 'GET', undefined, two)).json(),
      []
    )

    assert.equal(
      (
        await request(
          '/bookings/' + id,
          'PATCH',
          { ...data, slotId: second.id },
          one
        )
      ).status,
      200
    )

    assert.equal(
      (await (await request('/bookings', 'GET', undefined, one)).json())[0].slotId,
      second.id
    )

    assert.equal(
      (await request('/bookings/' + id, 'DELETE', undefined, one)).status,
      200
    )

    assert.deepEqual(
      await (await request('/bookings', 'GET', undefined, one)).json(),
      []
    )

    await request('/auth/logout', 'POST', undefined, one)

    assert.equal((await request('/me', 'GET', undefined, one)).status, 401)
    assert.equal((await verify('BU-DEMO-001', 'signin')).status, 200)
  } finally {
    server.close()
    await once(server, 'close')
  }
})

test('quotes change with mood and at IST midnight', () => {
  const morning = Date.parse('2026-11-13T04:30:00Z')
  const end = Date.parse('2026-11-13T18:29:59Z')

  assert.equal(dailyQuote('Low', morning), dailyQuote('Low', end))
  assert.notEqual(dailyQuote('Low', end), dailyQuote('Low', end + 1000))
  assert.notEqual(dailyQuote('Low', end), dailyQuote('Rough', end))
})
