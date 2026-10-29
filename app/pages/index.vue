<script setup lang="ts">
// A shop's storefront, on the shop's own domain.
definePageMeta({ surface: 'shop' })

// Which shop: resolved once per request by the server middleware.
const shop = useShop()
// The shop's products: an API route that resolves the shop the same way.
const { data: products } = await useFetch('/api/storefront/products')

// On the server this is built from the request's Host header, which
// the tenant middleware set to the customer's domain. Customer domains
// are always HTTPS in production.
const { host } = useRequestURL()
const canonical = `https://${host}/`

useHead({
  title: shop.value?.name,
  link: [{ rel: 'canonical', href: canonical }],
})

const price = (cents: number) => `$${(cents / 100).toFixed(2)}`
</script>

<template>
  <main v-if="shop">
    <h1>{{ shop.name }}</h1>
    <p class="muted">{{ shop.tagline }}</p>

    <ul class="products">
      <li v-for="product in products" :key="product.id">
        <strong>{{ product.name }}</strong>
        <span>{{ price(product.price_cents) }}</span>
        <span v-if="product.in_stock" class="ok">In stock</span>
        <StockAlertForm v-else :product="product" />
      </li>
    </ul>

    <p class="muted small">Served on {{ host }}</p>
  </main>
</template>

<style scoped>
.products {
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.products li {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: baseline;
  border-bottom: 1px solid #e7e5e4;
  padding-bottom: 1rem;
}
.small {
  font-size: 0.8rem;
}
</style>
