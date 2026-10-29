import { listProducts } from '../../utils/shops'
import { requireShop } from '../../utils/tenant'

export default defineEventHandler((event) => {
  return listProducts(requireShop(event).id)
})
