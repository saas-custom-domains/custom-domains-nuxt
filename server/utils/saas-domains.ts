import { FetchError, ofetch } from 'ofetch'

// A small client for the SaaS Custom Domains API, on ofetch (the
// client behind Nuxt's $fetch).
// Docs: https://docs.saascustomdomains.com/custom-domains
type DomainResponse = { uuid: string; host: string; status: string }
type VerifyResponse = { dns_status: 'valid' | 'pending' | 'invalid' }

function api() {
  const account = process.env.SCD_ACCOUNT_UUID
  const upstream = process.env.SCD_UPSTREAM_UUID
  const base = process.env.SCD_API_URL ?? 'https://app.saascustomdomains.com'
  return ofetch.create({
    baseURL:
      `${base}/api/v1/accounts/${account}` +
      `/upstreams/${upstream}/custom_domains`,
    headers: { Authorization: `Bearer ${process.env.SCD_API_TOKEN}` },
    timeout: 10_000,
    retry: 0,
  })
}

export const saasDomains = {
  create(host: string, instructionsRecipient?: string) {
    return api()<DomainResponse>('', {
      method: 'POST',
      body: {
        host,
        // We email this address the exact DNS records to add.
        ...(instructionsRecipient && {
          instructions_recipient: instructionsRecipient,
        }),
      },
    })
  },

  verifyDns(uuid: string) {
    return api()<VerifyResponse>(`/${uuid}/verify_dns_records`, {
      method: 'POST',
    })
  },

  async remove(uuid: string) {
    try {
      await api()(`/${uuid}`, { method: 'DELETE' })
    } catch (e) {
      // Already gone is fine: the goal is that it doesn't exist.
      if (!(e instanceof FetchError && e.status === 404)) throw e
    }
  },
}
