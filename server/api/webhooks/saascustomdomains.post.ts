import {
  deleteDomainRow,
  findDomainByProviderUuid,
  setDomainStatus,
  setHttpsReady,
} from '../../utils/shops'
import { secureCompare } from '../../utils/secure-compare'

// Events: https://docs.saascustomdomains.com/webhooks
export default defineEventHandler(async (event) => {
  const token = String(getQuery(event).token ?? '')
  const expected = process.env.SCD_WEBHOOK_TOKEN
  if (!expected || !secureCompare(token, expected)) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const { event: name, domain: payload } = (await readBody(event)) ?? {}
  const domain = payload?.uuid && findDomainByProviderUuid(payload.uuid)
  setResponseStatus(event, 204)
  // Not ours (or already removed): acknowledge so it isn't retried.
  if (!domain) return null

  switch (name) {
    case 'domain_dns_proxy_record_valid':
      setDomainStatus(domain.id, 'active')
      break
    case 'domain_dns_proxy_record_invalid':
      setDomainStatus(domain.id, 'pending')
      break
    case 'tls_certificate_issued':
      setHttpsReady(domain.id)
      break
    case 'domain_deleted':
      // Removed in the SaaS Custom Domains dashboard.
      deleteDomainRow(domain.id)
      break
  }
  return null
})
