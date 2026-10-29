import type { CustomDomain } from '#shared/types/shop'
import { saasDomains } from './saas-domains'
import {
  deleteDomainRow,
  insertDomain,
  setDomainStatus,
  setProviderUuid,
} from './shops'

export async function addDomain(
  shopId: number,
  host: string,
  dnsContact?: string,
): Promise<CustomDomain> {
  const domain = insertDomain(shopId, host)
  try {
    const res = await saasDomains.create(host, dnsContact)
    setProviderUuid(domain.id, res.uuid)
    return { ...domain, provider_uuid: res.uuid }
  } catch (e) {
    // Don't keep a row the proxy doesn't know about.
    deleteDomainRow(domain.id)
    throw e
  }
}

// Asks SaaS Custom Domains to check the DNS records now, instead of
// waiting for the next scheduled check and its webhook.
export async function checkDomain(domain: CustomDomain) {
  if (!domain.provider_uuid) return false
  const res = await saasDomains.verifyDns(domain.provider_uuid)
  const valid = res.dns_status === 'valid'
  setDomainStatus(domain.id, valid ? 'active' : 'pending')
  return valid
}

export async function removeDomain(domain: CustomDomain) {
  // Proxy first, database second: if the API call fails, the row is
  // still here and the user can retry.
  if (domain.provider_uuid) {
    await saasDomains.remove(domain.provider_uuid)
  }
  deleteDomainRow(domain.id)
}
