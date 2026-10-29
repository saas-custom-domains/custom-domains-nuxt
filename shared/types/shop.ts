// Used by both the server and the pages.
export type Shop = { id: number; slug: string; name: string; tagline: string }

export type Product = {
  id: number
  shop_id: number
  name: string
  price_cents: number
  in_stock: number
}

export type CustomDomain = {
  id: number
  shop_id: number
  host: string
  status: 'pending' | 'active'
  https_ready: number
  provider_uuid: string | null
}
