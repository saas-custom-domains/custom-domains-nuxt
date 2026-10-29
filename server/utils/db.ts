import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import path from 'node:path'

let instance: DatabaseSync | undefined

// One connection per server process, opened on first use so that
// `nuxt build` never touches it. Swap for Postgres in a real app; the
// queries are plain SQL.
export function db() {
  instance ??= open()
  return instance
}

function open() {
  const dir = process.env.DATA_DIR ?? path.join(process.cwd(), 'data')
  mkdirSync(dir, { recursive: true })
  const db = new DatabaseSync(path.join(dir, 'app.db'), { timeout: 5000 })
  migrate(db)
  seed(db)
  return db
}

function migrate(db: DatabaseSync) {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS shops (
      id INTEGER PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      tagline TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY,
      shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      price_cents INTEGER NOT NULL,
      in_stock INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS custom_domains (
      id INTEGER PRIMARY KEY,
      shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
      host TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'active')),
      https_ready INTEGER NOT NULL DEFAULT 0,
      provider_uuid TEXT UNIQUE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS stock_alerts (
      id INTEGER PRIMARY KEY,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      UNIQUE (product_id, email)
    );
  `)
}

function seed(db: DatabaseSync) {
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM shops').get() as {
    n: number
  }
  if (n > 0) return

  const shop = db.prepare(
    'INSERT INTO shops (slug, name, tagline) VALUES (?, ?, ?) RETURNING id',
  )
  const product = db.prepare(
    `INSERT INTO products (shop_id, name, price_cents, in_stock)
     VALUES (?, ?, ?, ?)`,
  )

  const fern = shop.get(
    'fern',
    'Fern & Clay',
    'Hand-thrown stoneware from a two-person studio.',
  ) as { id: number }
  product.run(fern.id, 'Moss glaze mug', 3200, 0)
  product.run(fern.id, 'Speckled pour-over cone', 4500, 1)
  product.run(fern.id, 'Small serving bowl', 3800, 1)

  const harbor = shop.get(
    'harbor',
    'Harbor Tea Co.',
    'Loose-leaf tea, blended and packed by hand.',
  ) as { id: number }
  product.run(harbor.id, 'Sea fog Earl Grey', 1400, 1)
  product.run(harbor.id, 'First flush Darjeeling', 2200, 0)
}
