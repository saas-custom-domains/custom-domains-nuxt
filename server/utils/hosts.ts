// Hostnames that serve the app itself (the dashboard), not a shop.
// "localhost" covers local development; set APP_HOSTS in production.
export const APP_HOSTS = (process.env.APP_HOSTS ?? 'localhost')
  .split(',')
  .map((h) => normalizeHost(h))
  .filter(Boolean)

// The domain your customers can't claim (e.g. "shopfront.app").
const APP_DOMAIN = normalizeHost(process.env.APP_DOMAIN ?? '')

// "Shop.Example.com." and "shop.example.com:443" are the same host.
export function normalizeHost(input: string): string {
  return input.trim().toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '')
}

const LABEL = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/

export function isValidHost(host: string): boolean {
  if (host.length > 253) return false
  const labels = host.split('.')
  return labels.length >= 2 && labels.every((l) => LABEL.test(l))
}

export function isAppHost(host: string): boolean {
  return APP_HOSTS.includes(host)
}

export function isReservedHost(host: string): boolean {
  if (isAppHost(host)) return true
  if (!APP_DOMAIN) return false
  return host === APP_DOMAIN || host.endsWith(`.${APP_DOMAIN}`)
}
