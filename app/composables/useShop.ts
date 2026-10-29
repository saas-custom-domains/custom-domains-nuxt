import type { Shop } from '#shared/types/shop'

// The shop for this domain, as found by server/middleware/1.tenant.ts.
// Read once on the server and sent to the browser in the payload, so
// client-side navigation knows it too. null on your own domain.
export function useShop() {
  return useState<Shop | null>(
    'shop',
    () => useRequestEvent()?.context.shop ?? null,
  )
}
