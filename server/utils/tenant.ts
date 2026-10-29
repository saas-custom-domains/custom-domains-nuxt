import { createError, getRequestHeader, type H3Event } from 'h3'
import { secureCompare } from './secure-compare'

// Requests from SaaS Custom Domains carry the upstream's auth token.
// With no token configured, nothing counts as coming from the proxy.
export function hasValidProxyToken(event: H3Event): boolean {
  const expected = process.env.PROXY_AUTH_TOKEN
  const token =
    getRequestHeader(event, 'x-saas-domains-auth-token') ?? ''
  return Boolean(expected) && secureCompare(token, expected!)
}

// For API routes that only make sense on a shop's domain.
export function requireShop(event: H3Event) {
  const shop = event.context.shop
  if (!shop) throw createError({ statusCode: 404 })
  return shop
}

// For API routes that belong to the dashboard on your own domain.
export function requireAppHost(event: H3Event) {
  if (event.context.shop) throw createError({ statusCode: 404 })
}
