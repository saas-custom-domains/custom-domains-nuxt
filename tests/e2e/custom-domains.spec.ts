import { expect, test, type Page } from '@playwright/test'

// Customer domains go through the mock proxy (see playwright.config.ts).
const customerUrl = (host: string) => `http://${host}/`
// Unique per test run and worker, since the stack keeps its database.
const unique = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

async function connect(page: Page, shop: string, host: string) {
  await page.goto('/dashboard')
  const section = page.getByTestId(`shop-${shop}`)
  await section.getByLabel('Domain').fill(host)
  await section.getByRole('button', { name: 'Add domain' }).click()
  const row = page.getByTestId(`domain-${host}`)
  await expect(row).toBeVisible()

  // The mock marks *.test as pointed after ~2s and sends webhooks.
  await expect(async () => {
    await page.reload()
    await expect(row).toContainText('Live')
  }).toPass({ timeout: 15_000 })
  return row
}

test('connect a domain, serve the shop through the proxy, remove it', async ({
  page,
}) => {
  const host = `fern-${unique()}.test`
  const hydrationWarnings: string[] = []
  page.on('console', (msg) => {
    if (msg.text().includes('Hydration')) hydrationWarnings.push(msg.text())
  })

  const row = await connect(page, 'fern', host)

  await page.goto(customerUrl(host))
  await expect(page.getByRole('heading', { name: 'Fern & Clay' })).toBeVisible()
  await expect(page).toHaveTitle('Fern & Clay')
  await expect(page.locator('link[rel=canonical]')).toHaveAttribute(
    'href',
    `https://${host}/`,
  )

  // A POST from the customer's domain, through the proxy.
  await page.getByLabel('Email for Moss glaze mug').fill('reader@example.com')
  await page.getByRole('button', { name: 'Notify me' }).click()
  await expect(page.getByRole('status')).toHaveText(
    "We'll email you when Moss glaze mug is back in stock.",
  )
  expect(hydrationWarnings).toEqual([])

  await page.goto('/dashboard')
  await row.getByRole('button', { name: 'Remove' }).click()
  await expect(row).toBeHidden()
  const gone = await page.goto(customerUrl(host))
  expect(gone?.status()).toBe(404)
})

test("two shops never see each other's cached page", async ({ page }) => {
  const fern = `fern-cache-${unique()}.test`
  const harbor = `harbor-cache-${unique()}.test`
  await connect(page, 'fern', fern)
  await connect(page, 'harbor', harbor)

  // "/" is cached (nuxt.config.ts). Same path, different domains.
  await page.goto(customerUrl(fern))
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Fern & Clay')
  await page.goto(customerUrl(harbor))
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Harbor Tea Co.',
  )
  await expect(page.getByText('Sea fog Earl Grey')).toBeVisible()
})

test('a domain that does not point at us stays pending', async ({ page }) => {
  const host = `shop-${unique()}.example.com`
  const section = page.getByTestId('shop-harbor')

  await page.goto('/dashboard')
  await section.getByLabel('Domain').fill(host)
  await section.getByRole('button', { name: 'Add domain' }).click()
  const row = page.getByTestId(`domain-${host}`)
  await row.getByRole('button', { name: 'Check DNS' }).click()
  await expect(row).toContainText('Waiting for DNS')

  await row.getByRole('button', { name: 'Remove' }).click()
  await expect(row).toBeHidden()
})

test('rejects our own domains', async ({ page }) => {
  const section = page.getByTestId('shop-fern')
  await page.goto('/dashboard')
  await section.getByLabel('Domain').fill('admin.shopfront.app')
  await section.getByRole('button', { name: 'Add domain' }).click()
  await expect(section.getByRole('alert')).toHaveText(
    "That's one of our domains.",
  )
})

test('requests that skip the proxy cannot claim a domain', async ({
  request,
}) => {
  const spoofed = await request.get('/', {
    headers: { 'X-Served-For': 'fern.test' },
  })
  expect(spoofed.status()).toBe(403)

  const wrongToken = await request.get('/', {
    headers: {
      'X-Served-For': 'fern.test',
      'X-SaaS-Domains-Auth-Token': 'guess',
    },
  })
  expect(wrongToken.status()).toBe(403)
})

test('webhooks need the right token', async ({ request }) => {
  const res = await request.post('/api/webhooks/saascustomdomains?token=x', {
    data: { event: 'domain_dns_proxy_record_valid', domain: { uuid: 'x' } },
  })
  expect(res.status()).toBe(401)
})

test('unknown domains get a 404', async ({ page }) => {
  const res = await page.goto(customerUrl('unknown.test'))
  expect(res?.status()).toBe(404)
})
