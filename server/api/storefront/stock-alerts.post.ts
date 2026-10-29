import { addStockAlert, findProduct } from '../../utils/shops'
import { requireShop } from '../../utils/tenant'

// "Notify me when it's back in stock". The shop comes from the
// request's domain, never from the form, so a product ID from another
// shop is simply not found.
export default defineEventHandler(async (event) => {
  const shop = requireShop(event)
  const body = await readBody<{ productId?: unknown; email?: unknown }>(event)
  const email = String(body?.email ?? '').trim()
  const product = findProduct(shop.id, Number(body?.productId))

  if (!product) {
    throw createError({ statusCode: 404, statusMessage: 'Unknown product' })
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    throw createError({ statusCode: 400, statusMessage: 'Enter a valid email.' })
  }
  addStockAlert(product.id, email)
  return { message: `We'll email you when ${product.name} is back in stock.` }
})
