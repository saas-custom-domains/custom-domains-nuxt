import {
  defineEventHandler,
  getRequestHeader,
  setResponseStatus,
} from 'h3'
import { isAppHost, normalizeHost } from '../utils/hosts'
import { findShopByActiveHost } from '../utils/shops'
import { hasValidProxyToken } from '../utils/tenant'

// Finds the shop for every request, from the hostname.
export default defineEventHandler((event) => {
  // Load balancers and Docker call the health check by IP address.
  if (event.path === '/api/up') return

  // Behind SaaS Custom Domains, Host is your own hostname and the
  // customer's domain arrives in X-Served-For. Only trust it with the
  // upstream's auth token, or anyone could claim any customer's domain.
  const servedFor = getRequestHeader(event, 'x-served-for')
  if (servedFor !== undefined && !hasValidProxyToken(event)) {
    setResponseStatus(event, 403)
    return 'Forbidden'
  }

  // Without X-Served-For, the Host header decides: your own domain, or
  // a customer's domain on a request this app makes to itself (useFetch
  // during server rendering, after the Host fix below).
  const host = normalizeHost(
    servedFor ?? getRequestHeader(event, 'host') ?? '',
  )
  if (isAppHost(host)) return

  const shop = findShopByActiveHost(host)
  if (!shop) {
    setResponseStatus(event, 404)
    return 'Unknown domain'
  }
  event.context.shop = shop

  if (servedFor !== undefined) {
    // From here on, the request is for the customer's domain. Nuxt and
    // h3 build URLs from Host (useRequestURL, getRequestURL), and the
    // cache in nuxt.config.ts varies on it, so give them the domain the
    // browser is on rather than your own hostname.
    event.node.req.headers.host = host
    event.node.req.headers['x-forwarded-host'] = host
  }
})
