import { checkDomain } from '../../../../utils/domain-service'
import { findDomain } from '../../../../utils/shops'
import { requireAppHost } from '../../../../utils/tenant'

export default defineEventHandler(async (event) => {
  requireAppHost(event)
  const domain = findDomain(Number(getRouterParam(event, 'id')))
  if (!domain) throw createError({ statusCode: 404 })
  return { valid: await checkDomain(domain) }
})
