// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2026-10-28',
  devtools: { enabled: false },

  vite: {
    server: {
      // `nuxt dev` only. Vite answers "Blocked request. This host is not
      // allowed." to Host headers it doesn't know. Behind the proxy, Host
      // is your app's own hostname (here, how the mock in Docker reaches
      // your machine), never the customer's domain.
      allowedHosts: ['host.docker.internal'],
    },
  },

  routeRules: {
    // The storefront is cached for a minute and refreshed in the
    // background. Nitro keys cached pages by path only, so without
    // `varies` the first shop to be rendered at "/" would be served on
    // every customer domain. server/middleware/1.tenant.ts sets Host to
    // the customer's domain, so varying on Host gives each shop its
    // own cache entry.
    '/': { cache: { swr: true, maxAge: 60, varies: ['host'] } },
  },
})
