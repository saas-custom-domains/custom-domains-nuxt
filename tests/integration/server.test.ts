import { $fetch, fetch, setup } from '@nuxt/test-utils/e2e'
import { beforeAll, describe, expect, it } from 'vitest'
import { db } from '../../server/utils/db'

// Builds the app, starts it, and sends requests the way SaaS Custom
// Domains forwards them: Host is the app's own hostname and the
// customer's domain is in X-Served-For.
const proxyHeaders = (domain: string) => ({
  'x-served-for': domain,
  'x-saas-domains-auth-token': 'test_token',
  'x-forwarded-proto': 'https',
})

beforeAll(() => {
  // Before the server starts, so it reads the same database.
  db().exec(`
    INSERT INTO custom_domains (shop_id, host, status) VALUES
      (1, 'shop.fern.com', 'active'),
      (2, 'tea.harbor.com', 'active');
  `)
})

await setup({ server: true, browser: false })

describe('storefront through the proxy', () => {
  it("never serves one shop's cached page on another shop's domain", async () => {
    // "/" has a swr cache rule (nuxt.config.ts). Without `varies`, the
    // second request gets Fern & Clay's page from the cache.
    const fern = await $fetch<string>('/', { headers: proxyHeaders('shop.fern.com') })
    const harbor = await $fetch<string>('/', { headers: proxyHeaders('tea.harbor.com') })
    const fernAgain = await $fetch<string>('/', { headers: proxyHeaders('shop.fern.com') })

    expect(fern).toContain('<title>Fern &amp; Clay</title>')
    expect(harbor).toContain('<title>Harbor Tea Co.</title>')
    expect(harbor).toContain('Sea fog Earl Grey')
    expect(fernAgain).toContain('<title>Fern &amp; Clay</title>')
  })

  it("builds absolute URLs from the customer's domain", async () => {
    const html = await $fetch<string>('/', { headers: proxyHeaders('shop.fern.com') })
    // Without the Host fix: https://127.0.0.1:<port>/
    expect(html).toContain('<link rel="canonical" href="https://shop.fern.com/">')
  })

  it('accepts the back-in-stock form from the customer domain', async () => {
    const res = await fetch('/api/storefront/stock-alerts', {
      method: 'POST',
      headers: {
        ...proxyHeaders('shop.fern.com'),
        origin: 'https://shop.fern.com',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ productId: 1, email: 'reader@example.com' }),
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      message: "We'll email you when Moss glaze mug is back in stock.",
    })
  })

  it("won't take another shop's product on this domain", async () => {
    const res = await fetch('/api/storefront/stock-alerts', {
      method: 'POST',
      headers: {
        ...proxyHeaders('tea.harbor.com'),
        origin: 'https://tea.harbor.com',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ productId: 1, email: 'reader@example.com' }),
    })
    expect(res.status).toBe(404)
  })
})

describe('your own domain', () => {
  it('sends / to the dashboard', async () => {
    const res = await fetch('/', { redirect: 'manual' })
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('/dashboard')
  })

  it('serves the dashboard here but not on a customer domain', async () => {
    expect((await fetch('/dashboard')).status).toBe(200)
    const onShop = await fetch('/dashboard', { headers: proxyHeaders('shop.fern.com') })
    expect(onShop.status).toBe(404)
    const api = await fetch('/api/dashboard/shops', { headers: proxyHeaders('shop.fern.com') })
    expect(api.status).toBe(404)
  })

  it('has no storefront API', async () => {
    expect((await fetch('/api/storefront/products')).status).toBe(404)
  })
})

describe('requests that skip the proxy', () => {
  it('cannot claim a domain with X-Served-For', async () => {
    const spoofed = await fetch('/', { headers: { 'x-served-for': 'shop.fern.com' } })
    expect(spoofed.status).toBe(403)
    const wrongToken = await fetch('/', {
      headers: { ...proxyHeaders('shop.fern.com'), 'x-saas-domains-auth-token': 'guess' },
    })
    expect(wrongToken.status).toBe(403)
  })

  it('get 404 for unknown domains', async () => {
    const res = await fetch('/', { headers: proxyHeaders('unknown.example.com') })
    expect(res.status).toBe(404)
  })
})
