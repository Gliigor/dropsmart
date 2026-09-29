/**
 * POST /api/search
 *
 * Validates the request, applies the per-IP daily limit, runs the search pipeline
 * (see lib/search.ts) and records the search for analytics.
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getClientIp, hashIp } from '@/lib/rateLimit'
import { SearchError, runSearch } from '@/lib/search'
import { saveSearch } from '@/lib/supabase'
import type { ApiError, ProviderId, SearchRequest, SearchResult, WalkMinutes } from '@/lib/types'

export const runtime = 'nodejs'
export const maxDuration = 60 // seconds

const WALK_OPTIONS: WalkMinutes[] = [3, 5, 10, 15]
const PROVIDERS: ProviderId[] = ['uber', 'bolt']
const MAX_TEXT_LENGTH = 200

type Parsed = { ok: true; value: SearchRequest } | { ok: false; error: string }

function parseBody(body: unknown): Parsed {
  if (typeof body !== 'object' || body === null) return { ok: false, error: 'Invalid JSON body' }
  const b = body as Record<string, unknown>

  const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
  const pickup = text(b.pickup)
  const destination = text(b.destination)
  if (!pickup || !destination) return { ok: false, error: 'pickup and destination are required' }
  if (pickup.length > MAX_TEXT_LENGTH || destination.length > MAX_TEXT_LENGTH) {
    return { ok: false, error: 'pickup and destination must be under 200 characters' }
  }

  const maxWalkingMinutes = b.maxWalkingMinutes as WalkMinutes
  if (!WALK_OPTIONS.includes(maxWalkingMinutes)) {
    return { ok: false, error: 'maxWalkingMinutes must be 3, 5, 10, or 15' }
  }

  const provider = (b.provider ?? 'bolt') as ProviderId
  if (!PROVIDERS.includes(provider)) return { ok: false, error: 'provider must be uber or bolt' }

  const optionalNumber = (v: unknown, name: string, min: number, max: number) => {
    if (v === undefined || v === null || v === '') return { value: undefined }
    if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) {
      return { error: `${name} must be a number between ${min} and ${max}` }
    }
    return { value: v }
  }
  const quote = optionalNumber(b.directQuote, 'directQuote', 1, 500)
  if (quote.error) return { ok: false, error: quote.error }
  const time = optionalNumber(b.valueOfTimePerHour, 'valueOfTimePerHour', 0, 200)
  if (time.error) return { ok: false, error: time.error }

  return {
    ok: true,
    value: {
      pickup,
      destination,
      maxWalkingMinutes,
      provider,
      directQuote: quote.value,
      valueOfTimePerHour: time.value,
    },
  }
}

export async function POST(req: NextRequest): Promise<NextResponse<SearchResult | ApiError>> {
  let parsed: Parsed
  try {
    parsed = parseBody(await req.json())
  } catch {
    parsed = { ok: false, error: 'Invalid JSON body' }
  }
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const ip = getClientIp(req.headers)
  const rateLimit = checkRateLimit(ip)
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: 'Rate limit exceeded. You have used all 10 free searches today.',
        code: 'RATE_LIMIT_EXCEEDED',
        remaining: 0,
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': rateLimit.resetAt.toISOString(),
        },
      }
    )
  }

  try {
    const result = await runSearch(parsed.value)

    // Analytics only: `savings` is the best option's net benefit, or 0 when riding is better.
    hashIp(ip)
      .then((ipHash) =>
        saveSearch({
          pickup: parsed.value.pickup,
          destination: parsed.value.destination,
          pickup_lat: result.pickup.lat,
          pickup_lng: result.pickup.lng,
          dest_lat: result.destination.lat,
          dest_lng: result.destination.lng,
          direct_price: result.direct.fare,
          best_price: result.best?.fare,
          savings: result.verdict === 'walk' ? result.best?.net : 0,
          walking_minutes: parsed.value.maxWalkingMinutes,
          provider: parsed.value.provider,
          ip_hash: ipHash,
        })
      )
      .catch((err) => console.error('[Supabase] save search error:', err))

    return NextResponse.json(
      { ...result, rateLimitRemaining: rateLimit.remaining },
      {
        headers: {
          'X-RateLimit-Remaining': rateLimit.remaining.toString(),
          'X-RateLimit-Reset': rateLimit.resetAt.toISOString(),
        },
      }
    )
  } catch (err) {
    const status = err instanceof SearchError ? err.status : 500
    const message = err instanceof Error ? err.message : 'Internal server error'
    console.error('[Search API] Error:', message)
    return NextResponse.json({ error: message }, { status })
  }
}
