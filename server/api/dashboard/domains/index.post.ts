import { addDomain } from '../../../utils/domain-service'
import { isReservedHost, isValidHost, normalizeHost } from '../../../utils/hosts'
import { requireAppHost } from '../../../utils/tenant'

export default defineEventHandler(async (event) => {
  requireAppHost(event)
  const body = await readBody<{
    shopId?: unknown
    host?: unknown
    dnsContact?: unknown
  }>(event)
  const host = normalizeHost(String(body?.host ?? ''))
  const dnsContact = String(body?.dnsContact ?? '').trim() || undefined

  if (!isValidHost(host)) {
    throw createError({
      statusCode: 400,
      statusMessage: `"${host}" isn't a valid domain.`,
    })
  }
  if (isReservedHost(host)) {
    throw createError({
      statusCode: 400,
      statusMessage: "That's one of our domains.",
    })
  }

  try {
    return await addDomain(Number(body?.shopId), host, dnsContact)
  } catch (e) {
    if (String(e).includes('UNIQUE')) {
      throw createError({
        statusCode: 400,
        statusMessage: `${host} is already connected to a shop.`,
      })
    }
    console.error(e)
    throw createError({
      statusCode: 502,
      statusMessage: 'Could not add the domain. Try again.',
    })
  }
})
