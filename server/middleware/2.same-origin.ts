import {
  createError,
  defineEventHandler,
  getRequestHeader,
  getRequestHost,
} from 'h3'
import { normalizeHost } from '../utils/hosts'

// Nuxt has no built-in CSRF protection. Browsers send Origin with
// every POST, so a request whose Origin isn't the host it was sent to
// came from another site's page.
export default defineEventHandler((event) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(event.method)) return
  // Server to server, protected by its own token.
  if (event.path.startsWith('/api/webhooks/')) return

  const origin = getRequestHeader(event, 'origin')
  const host = normalizeHost(getRequestHost(event))
  if (!origin || normalizeHost(URL.parse(origin)?.host ?? '') !== host) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Cross-site request blocked',
      message: `Origin ${origin ?? '(none)'} does not match ${host}.`,
    })
  }
})
