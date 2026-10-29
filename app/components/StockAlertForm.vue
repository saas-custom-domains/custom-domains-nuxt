<script setup lang="ts">
import type { Product } from '#shared/types/shop'

const props = defineProps<{ product: Product }>()

const email = ref('')
const pending = ref(false)
const hydrated = useHydrated()
const result = ref<{ ok: boolean; message: string } | null>(null)

async function submit() {
  pending.value = true
  try {
    // A POST to this domain. The shop comes from the domain, not
    // from the form.
    const res = await $fetch('/api/storefront/stock-alerts', {
      method: 'POST',
      body: { productId: props.product.id, email: email.value },
    })
    result.value = { ok: true, message: res.message }
  } catch (e: any) {
    result.value = {
      ok: false,
      message: e?.data?.statusMessage ?? 'Something went wrong.',
    }
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <form class="alert-form" @submit.prevent="submit">
    <span class="muted">Sold out.</span>
    <input
      v-model="email"
      type="email"
      required
      placeholder="you@example.com"
      :aria-label="`Email for ${product.name}`"
    >
    <button :disabled="pending || !hydrated">Notify me</button>
    <p v-if="result" role="status" :class="result.ok ? 'ok' : 'error'">
      {{ result.message }}
    </p>
  </form>
</template>

<style scoped>
.alert-form {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: baseline;
}
.alert-form p {
  flex-basis: 100%;
  margin: 0;
}
</style>
