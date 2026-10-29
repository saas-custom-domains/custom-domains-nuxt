// Health check for Docker and load balancers. The tenant middleware
// skips this path, because they call it by IP address.
export default defineEventHandler(() => 'ok')
