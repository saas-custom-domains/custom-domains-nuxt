import { db } from './db'
import type { CustomDomain, Product, Shop } from '#shared/types/shop'

// The one lookup every customer-facing request depends on.
// Keep the UNIQUE index on custom_domains.host.
export function findShopByActiveHost(host: string): Shop | null {
  return (db()
    .prepare(
      `SELECT shops.* FROM shops
       JOIN custom_domains ON custom_domains.shop_id = shops.id
       WHERE custom_domains.host = ? AND custom_domains.status = 'active'`,
    )
    .get(host) ?? null) as Shop | null
}

export function isActiveHost(host: string): boolean {
  return findShopByActiveHost(host) !== null
}

export function listShopsWithDomains() {
  const shops = db().prepare('SELECT * FROM shops ORDER BY id').all() as Shop[]
  const domains = db()
    .prepare('SELECT * FROM custom_domains ORDER BY id')
    .all() as CustomDomain[]
  return shops.map((s) => ({
    ...s,
    domains: domains.filter((d) => d.shop_id === s.id),
  }))
}

export function listProducts(shopId: number): Product[] {
  return db()
    .prepare('SELECT * FROM products WHERE shop_id = ? ORDER BY id')
    .all(shopId) as Product[]
}

// Scoped to the shop, so a product ID from another shop is "not found".
export function findProduct(shopId: number, id: number): Product | null {
  return (db()
    .prepare('SELECT * FROM products WHERE shop_id = ? AND id = ?')
    .get(shopId, id) ?? null) as Product | null
}

export function addStockAlert(productId: number, email: string) {
  db()
    .prepare(
      'INSERT OR IGNORE INTO stock_alerts (product_id, email) VALUES (?, ?)',
    )
    .run(productId, email)
}

export function findDomain(id: number): CustomDomain | null {
  return (db().prepare('SELECT * FROM custom_domains WHERE id = ?').get(id) ??
    null) as CustomDomain | null
}

export function findDomainByProviderUuid(uuid: string): CustomDomain | null {
  return (db()
    .prepare('SELECT * FROM custom_domains WHERE provider_uuid = ?')
    .get(uuid) ?? null) as CustomDomain | null
}

export function insertDomain(shopId: number, host: string): CustomDomain {
  return db()
    .prepare(
      'INSERT INTO custom_domains (shop_id, host) VALUES (?, ?) RETURNING *',
    )
    .get(shopId, host) as CustomDomain
}

export function setDomainStatus(id: number, status: CustomDomain['status']) {
  db()
    .prepare('UPDATE custom_domains SET status = ? WHERE id = ?')
    .run(status, id)
}

export function setHttpsReady(id: number) {
  db().prepare('UPDATE custom_domains SET https_ready = 1 WHERE id = ?').run(id)
}

export function setProviderUuid(id: number, uuid: string) {
  db()
    .prepare('UPDATE custom_domains SET provider_uuid = ? WHERE id = ?')
    .run(uuid, id)
}

export function deleteDomainRow(id: number) {
  db().prepare('DELETE FROM custom_domains WHERE id = ?').run(id)
}

declare module 'h3' {
  interface H3EventContext {
    // Set by server/middleware/1.tenant.ts on customer domains.
    shop?: Shop
  }
}
