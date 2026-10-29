<script setup lang="ts">
const props = defineProps<{ shopId: number }>()
const emit = defineEmits<{ added: [] }>()

const host = ref('')
const dnsContact = ref('')
const error = ref('')
const pending = ref(false)
const hydrated = useHydrated()

async function submit() {
  pending.value = true
  error.value = ''
  try {
    await $fetch('/api/dashboard/domains', {
      method: 'POST',
      body: {
        shopId: props.shopId,
        host: host.value,
        dnsContact: dnsContact.value,
      },
    })
    host.value = ''
    dnsContact.value = ''
    emit('added')
  } catch (e: any) {
    error.value = e?.data?.statusMessage ?? 'Could not add the domain.'
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <form class="add" @submit.prevent="submit">
    <label>
      Domain
      <input v-model="host" required placeholder="shop.example.com">
    </label>
    <label>
      Email DNS instructions to (optional)
      <input v-model="dnsContact" type="email" placeholder="it@example.com">
    </label>
    <button :disabled="pending || !hydrated">Add domain</button>
    <p v-if="error" role="alert" class="error">{{ error }}</p>
  </form>
</template>

<style scoped>
.add {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: end;
}
label {
  display: flex;
  flex-direction: column;
  font-size: 0.85rem;
}
.add p {
  flex-basis: 100%;
  margin: 0;
}
</style>
