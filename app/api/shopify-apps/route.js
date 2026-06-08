import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
})

export async function GET() {
  try {
    const apps = await redis.get('shopify-apps') || []
    const storeName = await redis.get('shopify-store-name') || ''
    const settings = await redis.get('shopify-apps-settings') || {}
    return Response.json({ apps, storeName, ...settings })
  } catch (e) {
    return Response.json({ apps: [], storeName: '' })
  }
}

export async function POST(req) {
  try {
    const { apps, storeName, ...settings } = await req.json()
    if (apps) await redis.set('shopify-apps', apps)
    if (storeName !== undefined) await redis.set('shopify-store-name', storeName)
    if (Object.keys(settings).length) await redis.set('shopify-apps-settings', settings)
    return Response.json({ ok: true })
  } catch (e) {
    return Response.json({ ok: false })
  }
}
