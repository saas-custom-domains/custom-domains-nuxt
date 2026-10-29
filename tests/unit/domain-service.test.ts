import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../server/utils/db'
import { addDomain, removeDomain } from '../../server/utils/domain-service'
import { findDomain } from '../../server/utils/shops'

// A stand-in for the SaaS Custom Domains API that answers with
// whatever the test sets.
let reply = { status: 201, body: {} as object }
let server: Server

beforeAll(async () => {
  server = createServer((_req, res) => {
    res.writeHead(reply.status, { 'content-type': 'application/json' })
    res.end(JSON.stringify(reply.body))
  })
  await new Promise<void>((resolve) => server.listen(0, resolve))
  const { port } = server.address() as AddressInfo
  process.env.SCD_API_URL = `http://127.0.0.1:${port}`
})

afterAll(() => {
  server.close()
})

beforeEach(() => db().exec('DELETE FROM custom_domains'))

describe('addDomain', () => {
  it('stores the provider UUID', async () => {
    reply = { status: 201, body: { uuid: 'dom_1', host: 'a.example.com' } }
    const domain = await addDomain(1, 'a.example.com')
    expect(findDomain(domain.id)?.provider_uuid).toBe('dom_1')
  })

  it("doesn't keep the row when the API says no", async () => {
    reply = {
      status: 400,
      body: { error: 'Host has already been taken', error_code: 'host_taken' },
    }
    await expect(addDomain(1, 'b.example.com')).rejects.toMatchObject({
      status: 400,
      data: { error_code: 'host_taken' },
    })
    const n = db().prepare('SELECT COUNT(*) AS n FROM custom_domains').get()
    expect(n).toEqual({ n: 0 })
  })
})

describe('removeDomain', () => {
  it('treats 404 from the API as already removed', async () => {
    reply = { status: 201, body: { uuid: 'dom_2', host: 'c.example.com' } }
    const domain = await addDomain(1, 'c.example.com')
    reply = { status: 404, body: { error: 'not found', error_code: 'not_found' } }
    await removeDomain({ ...domain, provider_uuid: 'dom_2' })
    expect(findDomain(domain.id)).toBeNull()
  })

  it('keeps the row when the API call fails, so you can retry', async () => {
    reply = { status: 201, body: { uuid: 'dom_3', host: 'd.example.com' } }
    const domain = await addDomain(1, 'd.example.com')
    reply = { status: 500, body: {} }
    await expect(removeDomain(domain)).rejects.toBeTruthy()
    expect(findDomain(domain.id)).not.toBeNull()
  })
})
