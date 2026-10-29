<script setup lang="ts">
import type { CustomDomain } from '#shared/types/shop'

// The owner's dashboard, on your own domain.
definePageMeta({ surface: 'app' })
useHead({ title: 'Shopfront dashboard' })

// This example has no login. In your app, only show the signed-in
// user's shops.
const { data: shops, refresh } = await useFetch('/api/dashboard/shops')
const hydrated = useHydrated()

async function check(domain: CustomDomain) {
  await $fetch(`/api/dashboard/domains/${domain.id}/check`, { method: 'POST' })
  await refresh()
}

async function remove(domain: CustomDomain) {
  await $fetch(`/api/dashboard/domains/${domain.id}`, { method: 'DELETE' })
  await refresh()
}

function statusLabel(domain: CustomDomain) {
  if (domain.status !== 'active') return 'Waiting for DNS'
  return domain.https_ready ? 'Live' : 'DNS OK, waiting for HTTPS'
}
</script>

<template>
  <main>
    <h1>Shopfront dashboard</h1>
    <p class="muted">Connect a custom domain to each shop.</p>

    <section
      v-for="shop in shops"
      :key="shop.id"
      class="shop"
      :data-testid="`shop-${shop.slug}`"
    >
      <h2>{{ shop.name }}</h2>
      <ul>
        <li
          v-for="domain in shop.domains"
          :key="domain.id"
          :data-testid="`domain-${domain.host}`"
        >
          <code>{{ domain.host }}</code>
          <span
            class="badge"
            :class="domain.status === 'active' ? 'active' : 'pending'"
          >
            {{ statusLabel(domain) }}
          </span>
          <button type="button" :disabled="!hydrated" @click="check(domain)">Check DNS</button>
          <button type="button" :disabled="!hydrated" @click="remove(domain)">Remove</button>
        </li>
      </ul>
      <AddDomainForm :shop-id="shop.id" @added="refresh()" />
    </section>
  </main>
</template>

<style scoped>
.shop {
  border: 1px solid #e7e5e4;
  border-radius: 0.75rem;
  padding: 1rem 1.25rem;
  margin-top: 1.5rem;
  background: white;
}
ul {
  list-style: none;
  padding: 0;
}
li {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  margin-bottom: 0.5rem;
}
.badge {
  border-radius: 0.25rem;
  padding: 0.1rem 0.5rem;
  font-size: 0.85rem;
}
.active {
  background: #dcfce7;
}
.pending {
  background: #fef3c7;
}
</style>
