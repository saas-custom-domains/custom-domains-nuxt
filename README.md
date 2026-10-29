# Custom domains in Nuxt

An example Nuxt 4 app where each customer connects their own domain. It's a small storefront product, Shopfront: every shop gets a storefront, and its owner can serve it on `shop.theirbrand.com` instead of a Shopfront URL. Sold-out products have a "notify me when it's back in stock" form.

It goes with the guide [How to Add Custom Domains to a Nuxt App](https://saascustomdomains.com/blog/posts/custom-domains-nuxt).

What's in it:

- One Nitro server middleware finds the shop from the request's hostname and puts it on `event.context.shop`. Unknown and unverified domains get a 404.
- Requests from the [SaaS Custom Domains](https://saascustomdomains.com) proxy are accepted only with the upstream's auth token, so nobody can claim a customer's domain by sending `X-Served-For` themselves.
- The storefront is cached with a `routeRules` stale-while-revalidate rule, one cache entry per domain (see [Cached pages on the wrong domain](#cached-pages-on-the-wrong-domain)).
- `useRequestURL()`, canonical links and the form's origin check all see the customer's domain.
- A dashboard to add a domain, check its DNS and remove it. Webhooks update the status.
- HTTPS and routing for every customer domain come from SaaS Custom Domains, so the app itself never deals with certificates.

## Run it in 2 minutes

You need Docker.

```bash
git clone https://github.com/saas-custom-domains/custom-domains-nuxt
cd custom-domains-nuxt
docker compose up --build
```

1. Open http://localhost:3000 (it redirects to the dashboard) and add `fern.localhost` to Fern & Clay.
2. Within a few seconds the status changes to **Live**: the mock API "found" the DNS records and sent a webhook.
3. Open http://fern.localhost. The request goes through the mock proxy on port 80, exactly like a real customer domain goes through SaaS Custom Domains, and you see the Fern & Clay storefront. Try "Notify me" on the sold-out mug.

`*.localhost` always resolves to your own machine in Chrome, Firefox, Safari and curl, so there's nothing to add to `/etc/hosts`.

The mock is [scd-mock](https://github.com/saas-custom-domains/scd-mock): a local copy of the SaaS Custom Domains API and proxy, so you can try everything without an account.

### Without Docker

Run the app with `nuxt dev` and only the mock in Docker:

```bash
npm install
cp .env.example .env
docker run --rm -p 4010:4010 -p 8080:4080 \
  --add-host=host.docker.internal:host-gateway \
  -e SCD_MOCK_UPSTREAM_HOST=host.docker.internal \
  -e SCD_MOCK_UPSTREAM_PORT=3000 \
  -e SCD_MOCK_WEBHOOK_URL=http://host.docker.internal:3000/api/webhooks/saascustomdomains \
  -e SCD_MOCK_FORWARDED_PROTO=http \
  ghcr.io/saas-custom-domains/scd-mock:latest
npm run dev -- --host   # in another terminal
```

Add `fern.localhost` at http://localhost:3000, wait for **Live**, and open http://fern.localhost:8080. `--host` lets the mock's container reach `nuxt dev`.

## How it works

```
Browser ── shop.fern.com ──▶ SaaS Custom Domains ──▶ your Nuxt app
                             (TLS certificate,       Host: app.shopfront.app
                              proxy)                 X-Served-For: shop.fern.com
                                                     X-SaaS-Domains-Auth-Token: …
```

| File | What it does |
| --- | --- |
| `server/middleware/1.tenant.ts` | Checks the proxy token, finds the shop, sets `event.context.shop` and the request's Host |
| `server/middleware/2.same-origin.ts` | Rejects POSTs whose `Origin` isn't the domain they were sent to |
| `app/composables/useShop.ts` | The shop in pages, read from the server event and sent along in the payload |
| `app/middleware/surface.global.ts` | Storefront pages only on shop domains, the dashboard only on yours |
| `app/pages/index.vue` | The storefront |
| `server/api/storefront/stock-alerts.post.ts` | The "notify me" form, which takes the shop from the domain, not the form |
| `server/utils/domain-service.ts` | Add, check and remove domains |
| `server/utils/saas-domains.ts` | API client for SaaS Custom Domains, on `ofetch` |
| `server/api/webhooks/saascustomdomains.post.ts` | Webhook endpoint |
| `nuxt.config.ts` | The storefront's cache rule, and the dev server's allowed hosts |

Pages get the shop two ways. `useShop()` reads `event.context.shop` during server rendering and carries it to the browser in the payload, so there's no extra request. Data comes from API routes with `useFetch`: on the server, Nuxt calls them in-process and forwards the request headers, so the same middleware finds the same shop.

## The customer's domain in Nuxt

SaaS Custom Domains forwards your app's own hostname in `Host` and `X-Forwarded-Host`, because that's what hosting platforms route on and what most apps expect for allowed hosts, OAuth callbacks and links. The customer's domain arrives separately in `X-Served-For`.

If your Nuxt app needs the customer's domain for something (canonical links, absolute URLs, redirects, an origin check on forms), `server/middleware/1.tenant.ts` gives it that: once the auth token proves the request came through the proxy, it sets the request's `Host` and `X-Forwarded-Host` to the domain from `X-Served-For`. Everything that runs after it, including the page renderer, sees the customer's domain. (Support can also put the customer's domain in `X-Forwarded-Host` for your upstream, but Nuxt reads `Host` by default, so the middleware is still the simplest fix.)

### Cached pages on the wrong domain

`routeRules` such as `{ swr: 60 }` or `{ cache: { maxAge: 60 } }` cache the rendered page by path. Nitro's cache key is the path plus the request headers you list in `varies`, nothing else. On a multi-tenant app that means the first shop rendered at `/` is served on every customer's domain until the entry expires. There's no error; the wrong shop just shows up.

There's a second effect: Nitro removes every request header not listed in `varies` before it renders a cached route. Inside the render, `Host` is gone (`useRequestURL().host` is `localhost`), and `useFetch` calls to your own API routes arrive without `X-Served-For` or a Host to find the shop by.

The fix is one option, with the middleware above doing the rest:

```ts
routeRules: {
  '/': { cache: { swr: true, maxAge: 60, varies: ['host'] } },
},
```

Varying on `X-Served-For` instead doesn't work on its own: the inner `useFetch` calls would get `X-Served-For` but not the auth token, and the middleware would reject them. Because the middleware sets `Host` to the customer's domain, `varies: ['host']` is enough, and the inner calls find the shop by Host.

The integration test `never serves one shop's cached page on another shop's domain` fails without `varies` (Harbor Tea Co.'s domain gets Fern & Clay's page), and so does the e2e test `two shops never see each other's cached page`.

### `useRequestURL()` returns your own hostname

On the server, `useRequestURL()` is h3's `getRequestURL(event)`, built from the `Host` header. Behind the proxy that's your app's hostname, so a canonical link comes out as `https://app.shopfront.app/` on every shop. In the browser, `useRequestURL()` reads `window.location`, so anything rendered from it differs between server and client, and Vue reports:

```
Hydration completed but contains mismatches.
```

(In development, Vue's warning starts with `Hydration text content mismatch`.)

`getRequestHost(event, { xForwardedHost: true })` doesn't help either: by default `X-Forwarded-Host` is your own hostname too. With the middleware, both read the customer's domain. Covered by the `finds the shop from X-Served-For` unit test and the canonical link checks in the integration and e2e tests.

### CSRF and forms on customer domains

Nuxt has no built-in CSRF protection. This app checks that a POST's `Origin` matches the host it was sent to (`server/middleware/2.same-origin.ts`). Without the Host fix, every form on a customer domain fails, because the browser's `Origin` is `shop.fern.com` and the request's host is your own:

```
403 Cross-site request blocked
Origin http://fern.test does not match app.
```

If you use `nuxt-csurf` (or `nuxt-security`, which installs it), it compares a token in a header with a secret in a cookie and never looks at hostnames, so it works on customer domains without changes. Its cookie is `__Host-csrf` with `Secure` in production, which browsers won't store over the mock's plain-HTTP proxy.

### "Blocked request. This host is not allowed." in `nuxt dev`

When `nuxt dev` sits behind a proxy, Vite's dev server checks the `Host` header and answers 403:

```
Blocked request. This host ("host.docker.internal") is not allowed.
To allow this host, add "host.docker.internal" to `server.allowedHosts` in vite.config.js.
```

Behind SaaS Custom Domains (or the mock), `Host` is your app's own hostname, so that's the one to allow, in `nuxt.config.ts` under `vite.server.allowedHosts`. You never need to list customer domains there. Production builds don't have this check.

### Health checks and webhooks

Any host that isn't in `APP_HOSTS` is treated as a customer domain, and unknown ones get a 404. Two kinds of your own traffic hit that:

- Load balancers and Docker call the health check by IP address, so the middleware skips `/api/up`.
- Webhooks from the mock arrive as `Host: app:3000`, so `compose.yaml` lists `app` in `APP_HOSTS`. In production, list every hostname your platform uses to reach the app.

## Use it with your SaaS Custom Domains account

1. [Create an API token](https://app.saascustomdomains.com/api_tokens) and an upstream pointing at your deployed app.
2. Set the environment variables from `.env.example`: `SCD_API_TOKEN`, `SCD_ACCOUNT_UUID`, `SCD_UPSTREAM_UUID`, `PROXY_AUTH_TOKEN` (the upstream's auth token), `SCD_WEBHOOK_TOKEN` (from the webhook you create in the dashboard), and `APP_HOSTS`.
3. Remove `SCD_API_URL` so the client talks to the real API.

The server reads these with `process.env` at runtime, so one build runs in every environment. If you prefer `runtimeConfig`, the variables need a `NUXT_` prefix.

Your customers point a CNAME at `in.saascustomdomains.com` (or A records at our two static IPs for a root domain). SaaS Custom Domains checks their DNS, issues and renews the certificate, and forwards the traffic to your app; the "Check DNS" button and the webhooks keep the status in your dashboard up to date. Fill in "Email DNS instructions to" when adding a domain and we email that person the exact records to add. See the [docs](https://docs.saascustomdomains.com).

## Tests

```bash
npm test                       # unit + integration (builds and starts the app)
docker compose up -d --build --wait
npx playwright install chromium
npm run test:e2e               # end to end, through the mock proxy
```

The integration tests use `@nuxt/test-utils` to build the app and send it requests the way the proxy forwards them. The end-to-end tests use `*.test` domains and send the browser's requests for them to the mock proxy, so nothing depends on DNS or on port 80. To run a second stack side by side, set `APP_PORT`, `SCD_MOCK_API_PORT` and `SCD_MOCK_PROXY_PORT` for both `docker compose` and `npm run test:e2e`.

The mock proxy speaks plain HTTP, so `compose.yaml` sets `SCD_MOCK_FORWARDED_PROTO=http`. Production sends `X-Forwarded-Proto: https`.

CI runs both on every push and once a week, so a new Nuxt or Nitro release that breaks something shows up here first.

## Tested with

| | Version |
| --- | --- |
| Nuxt | 4.6.3 |
| Nitro (nitropack) | 2.13.5 |
| h3 | 1.15.11 |
| Vue | 3.5.44 |
| Node.js | 24 |

Last checked: 2026-10-29.

## Not production-ready on purpose

There's no login. In your app, check in every dashboard route that the signed-in user owns the shop and the domain. SQLite (`node:sqlite`) keeps the example small; use your own database.

## License

MIT
