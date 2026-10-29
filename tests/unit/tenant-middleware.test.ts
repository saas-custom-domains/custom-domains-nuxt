import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import {
  createApp,
  eventHandler,
  getRequestHost,
  getRequestURL,
  toWebHandler,
} from 'h3'
import { db } from '../../server/utils/db'
import tenant from '../../server/middleware/1.tenant'
import sameOrigin from '../../server/middleware/2.same-origin'

// The two server middlewares in front of a handler that reports what
// the rest of the app would see.
const app = createApp()
app.use(tenant)
app.use(sameOrigin)
app.use(
  eventHandler((event) => ({
    shop: event.context.shop?.slug ?? null,
    host: getRequestHost(event),
    url: getRequestURL(event).href,
  })),
)
const handle = toWebHandler(app)

function request(
  headers: Record<string, string>,
  init: { path?: string; method?: string } = {},
) {
  return handle(
    new Request(`http://localhost:3000${init.path ?? '/'}`, {
      method: init.method ?? 'GET',
      headers,
    }),
  )
}

// What SaaS Custom Domains sends for a visit to https://shop.fern.com.
const viaProxy = {
  host: 'shopfront.app',
  'x-forwarded-host': 'shopfront.app',
  'x-forwarded-proto': 'https',
  'x-served-for': 'shop.fern.com',
  'x-saas-domains-auth-token': 'test_token',
}

beforeAll(() => {
  db().exec(`
    DELETE FROM custom_domains;
    INSERT INTO custom_domains (shop_id, host, status) VALUES
      (1, 'shop.fern.com', 'active'),
      (2, 'tea.harbor.com', 'pending');
  `)
})

afterEach(() => {
  process.env.PROXY_AUTH_TOKEN = 'test_token'
})

describe('tenant middleware', () => {
  it('passes requests for the app itself through without a shop', async () => {
    const res = await request({ host: 'shopfront.app' })
    expect(await res.json()).toMatchObject({ shop: null })
  })

  it('finds the shop from the Host header (requests the app makes to itself)', async () => {
    const res = await request({ host: 'shop.fern.com' })
    expect(await res.json()).toMatchObject({ shop: 'fern' })
  })

  it('finds the shop from X-Served-For when the token is valid', async () => {
    const res = await request(viaProxy)
    expect(await res.json()).toEqual({
      shop: 'fern',
      // Without the fix, both of these say shopfront.app.
      host: 'shop.fern.com',
      url: 'https://shop.fern.com/',
    })
  })

  it('rejects X-Served-For without the right token', async () => {
    const { 'x-saas-domains-auth-token': _, ...spoofed } = viaProxy
    expect((await request(spoofed)).status).toBe(403)
    expect(
      (await request({ ...spoofed, 'x-saas-domains-auth-token': 'nope' }))
        .status,
    ).toBe(403)
  })

  it('rejects X-Served-For when no token is configured', async () => {
    delete process.env.PROXY_AUTH_TOKEN
    const res = await request({ ...viaProxy, 'x-saas-domains-auth-token': '' })
    expect(res.status).toBe(403)
  })

  it('returns 404 for pending and unknown domains', async () => {
    expect((await request({ host: 'tea.harbor.com' })).status).toBe(404)
    expect((await request({ host: 'evil.example' })).status).toBe(404)
    expect(await (await request({ host: 'evil.example' })).text()).toBe(
      'Unknown domain',
    )
  })

  it('lets the health check through on any host', async () => {
    const res = await request({ host: '10.0.0.7:3000' }, { path: '/api/up' })
    expect(res.status).toBe(200)
  })
})

describe('same-origin check', () => {
  it('accepts a POST from the customer domain through the proxy', async () => {
    const res = await request(
      { ...viaProxy, origin: 'https://shop.fern.com' },
      { method: 'POST' },
    )
    expect(res.status).toBe(200)
  })

  it('blocks a POST from another site', async () => {
    const res = await request(
      { ...viaProxy, origin: 'https://evil.example' },
      { method: 'POST' },
    )
    expect(res.status).toBe(403)
  })

  it('blocks a POST without an Origin header', async () => {
    const res = await request({ host: 'shopfront.app' }, { method: 'POST' })
    expect(res.status).toBe(403)
  })

  it('lets webhooks through, they have their own token', async () => {
    const res = await request(
      { host: 'shopfront.app' },
      { method: 'POST', path: '/api/webhooks/saascustomdomains' },
    )
    expect(res.status).toBe(200)
  })
})
