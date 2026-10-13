export const resolveAppUrl = (request?: Request): string => {
  if (
    process.env.NEXT_PUBLIC_APP_URL &&
    !process.env.NEXT_PUBLIC_APP_URL.includes('localhost')
  ) {
    return process.env.NEXT_PUBLIC_APP_URL
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }
  if (request) {
    const host =
      request.headers.get('x-forwarded-host') || request.headers.get('host')
    const proto = request.headers.get('x-forwarded-proto') || 'https'
    if (host) {
      return `${proto}://${host}`
    }
  }
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
}
