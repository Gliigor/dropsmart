/**
 * IP-based rate limiting for the DropSmart API.
 *
 * Free tier: 10 searches per IP per day.
 * Resets at midnight UTC.
 *
 * Implementation: in-memory Map for low-latency checks.
 * Also persists to Supabase for analytics (fire-and-forget).
 *
 * Note: In a multi-instance/serverless deployment (Vercel), each instance
 * has its own in-memory store. For precise rate limiting across instances,
 * use a Redis-backed solution (e.g. Upstash). For a launch product with
 * moderate traffic, in-memory per-instance is a reasonable tradeoff.
 */

const FREE_TIER_LIMIT = 10

interface RateLimitEntry {
  count: number
  resetAt: Date
}

/** In-memory store: ip → {count, resetAt} */
const rateLimitStore = new Map<string, RateLimitEntry>()

/**
 * Get the next midnight UTC reset time.
 */
function getNextMidnightUTC(): Date {
  const now = new Date()
  const midnight = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
  )
  return midnight
}

/**
 * Check and increment the rate limit for an IP address.
 *
 * @param ip - The client IP address
 * @returns { allowed, remaining, resetAt }
 */
export function checkRateLimit(ip: string): {
  allowed: boolean
  remaining: number
  resetAt: Date
} {
  const now = new Date()
  const entry = rateLimitStore.get(ip)

  // No entry or expired entry → fresh start
  if (!entry || entry.resetAt <= now) {
    const resetAt = getNextMidnightUTC()
    rateLimitStore.set(ip, { count: 1, resetAt })
    return { allowed: true, remaining: FREE_TIER_LIMIT - 1, resetAt }
  }

  // Over limit
  if (entry.count >= FREE_TIER_LIMIT) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt }
  }

  // Increment
  entry.count++
  return {
    allowed: true,
    remaining: FREE_TIER_LIMIT - entry.count,
    resetAt: entry.resetAt,
  }
}

/**
 * Get the current rate limit status without incrementing.
 * Used to show "X searches remaining" in the UI.
 */
export function getRateLimitStatus(ip: string): {
  remaining: number
  resetAt: Date
} {
  const now = new Date()
  const entry = rateLimitStore.get(ip)

  if (!entry || entry.resetAt <= now) {
    return { remaining: FREE_TIER_LIMIT, resetAt: getNextMidnightUTC() }
  }

  return {
    remaining: Math.max(0, FREE_TIER_LIMIT - entry.count),
    resetAt: entry.resetAt,
  }
}

/**
 * Extract the real client IP from Next.js request headers.
 * Handles proxies (Vercel, Cloudflare, etc.).
 */
export function getClientIp(headers: Headers): string {
  // Vercel sets x-real-ip
  const realIp = headers.get('x-real-ip')
  if (realIp) return realIp

  // Cloudflare
  const cfIp = headers.get('cf-connecting-ip')
  if (cfIp) return cfIp

  // Standard forwarded header
  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }

  // Fallback
  return '127.0.0.1'
}

/**
 * Hash an IP address for storage in Supabase (privacy-preserving).
 * Uses a simple hash — not cryptographically secure, just for analytics.
 */
export async function hashIp(ip: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(ip + (process.env.ADMIN_SECRET_KEY ?? 'salt'))
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16)
}

/** Periodic cleanup of expired entries (call from a background process or cron) */
export function cleanupExpiredEntries(): number {
  const now = new Date()
  let cleaned = 0
  rateLimitStore.forEach((entry, ip) => {
    if (entry.resetAt <= now) {
      rateLimitStore.delete(ip)
      cleaned++
    }
  })
  return cleaned
}
