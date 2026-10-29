import { removeDomain } from '../../../utils/domain-service'
import { findDomain } from '../../../utils/shops'
import { requireAppHost } from '../../../utils/tenant'

export default defineEventHandler(async (event) => {
  requireAppHost(event)
  const domain = findDomain(Number(getRouterParam(event, 'id')))
  if (domain) await removeDomain(domain)
  setResponseStatus(event, 204)
  return null
})
