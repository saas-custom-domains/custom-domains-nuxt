// false in the server-rendered HTML and until the page is interactive.
// Forms use it to keep their button disabled until the submit handler
// is attached, so an early click can't fall back to a plain GET.
export function useHydrated() {
  const hydrated = ref(false)
  onMounted(() => {
    hydrated.value = true
  })
  return hydrated
}
