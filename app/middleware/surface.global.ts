// Storefront pages only exist on a shop's domain, and dashboard pages
// only on your own. Pages say which with definePageMeta({ surface }).
export default defineNuxtRouteMiddleware((to) => {
  const shop = useShop()

  if (to.meta.surface === 'shop' && !shop.value) {
    if (to.path === '/') return navigateTo('/dashboard')
    return abortNavigation(createError({ statusCode: 404 }))
  }
  if (to.meta.surface === 'app' && shop.value) {
    return abortNavigation(createError({ statusCode: 404 }))
  }
})
