import { listShopsWithDomains } from '../../utils/shops'
import { requireAppHost } from '../../utils/tenant'

// This example has no login. In your app, only return the signed-in
// user's shops, and check ownership in every dashboard route.
export default defineEventHandler((event) => {
  requireAppHost(event)
  return listShopsWithDomains()
})
