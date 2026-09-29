/**
 * Main search API route.
 *
 * POST /api/search
 *
 * Flow:
 * 1. Rate limit check (IP-based, 10/day free tier)
 * 2. Geocode pickup + destination via Nominatim
 * 3. Generate candidate drop-off points around destination
 * 4. Get walking routes for all candidates (ORS)
 * 5. Filter candidates within max walking time
 * 6. Estimate fares for each valid candidate (Uber + Bolt)
 * 7. Calculate score for each alternative
 * 8. Filter alternatives with savings < €2
 * 9. Sort by score (ascending, lower = better)
 * 10. Mark best-score option as recommended
 * 11. Save search to Supabase
 * 12. Return results
 */

import { NextRequest, NextResponse } from 'next/server'
import { geocodeAddress } from '@/lib/geocoding'
import { generateCandidates } from '@/lib/candidates'
import { getWalkingRoutes } from '@/lib/walking'
import { calculateScore, calculateSavings, isWorthShowing } from '@/lib/scoring'
import { checkRateLimit, getClientIp, hashIp } from '@/lib/rateLimit'
import { saveSearch } from '@/lib/supabase'
import { getProviders } from '@/providers'
import type { SearchRequest, SearchResult, Alternative, ApiError } from '@/providers/types'

export const runtime = 'nodejs'
export const maxDuration = 60 // seconds (Vercel Pro/Hobby allows up to 60s)

export async function POST(req: NextRequest): Promise<NextResponse<SearchResult | ApiError>> {
  // 1. Rate limit check
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

  // Parse request body
  let body: SearchRequest
  try {
    body = (await req.json()) as SearchRequest
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { pickup, destination, maxWalkingMinutes, provider: providerPref } = body

  if (!pickup || !destination) {
    return NextResponse.json(
      { error: 'pickup and destination are required' },
      { status: 400 }
    )
  }

  if (![3, 5, 10, 15].includes(maxWalkingMinutes)) {
    return NextResponse.json(
      { error: 'maxWalkingMinutes must be 3, 5, 10, or 15' },
      { status: 400 }
    )
  }

  try {
    // 2. Geocode pickup + destination
    const [pickupGeo, destGeo] = await Promise.all([
      geocodeAddress(pickup),
      geocodeAddress(destination),
    ])

    // 3. Generate candidate drop-off points around destination
    const candidates = await generateCandidates(
      { lat: destGeo.lat, lng: destGeo.lng },
      maxWalkingMinutes
    )

    // 4. Get walking routes for all candidates
    const walkingRoutes = await getWalkingRoutes(
      { lat: destGeo.lat, lng: destGeo.lng }, // walk FROM drop-off TO destination
      candidates.map((c) => ({ lat: c.lat, lng: c.lng }))
    )

    // Determine which providers to use
    const providerNames =
      providerPref === 'uber'
        ? ['uber']
        : providerPref === 'bolt'
        ? ['bolt']
        : ['uber', 'bolt']
    const providers = getProviders(providerNames)

    // 5. Get direct fares (pickup → destination, no walking)
    const directFares = await Promise.all(
      providers.map((p) =>
        p.getFareEstimate(
          { lat: pickupGeo.lat, lng: pickupGeo.lng },
          { lat: destGeo.lat, lng: destGeo.lng }
        )
      )
    )

    const bestDirectFare = directFares.reduce((best, f) =>
      f.price < best.price ? f : best
    )

    // 6. Build alternatives: filter by walking time, estimate fares, score
    const alternatives: Alternative[] = []

    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i]
      const walkingRoute = walkingRoutes[i]

      // Skip if no walking route available
      if (!walkingRoute) continue

      // 5. Filter: only keep candidates within max walking time
      if (walkingRoute.durationMinutes > maxWalkingMinutes) continue

      // 6. Estimate fares for this candidate (pickup → candidate drop-off)
      const fareEstimates = await Promise.all(
        providers.map((p) =>
          p.getFareEstimate(
            { lat: pickupGeo.lat, lng: pickupGeo.lng },
            { lat: candidate.lat, lng: candidate.lng }
          )
        )
      )

      const bestFare = fareEstimates.reduce((best, f) =>
        f.price < best.price ? f : best
      )

      // 7. Calculate score (rideCost + walkingMinutes × walkingCostPerMin)
      const savings = calculateSavings(bestDirectFare.price, bestFare.price)
      const score = calculateScore(bestFare.price, walkingRoute.durationMinutes)

      // 9. Filter: drop alternatives with savings < €2
      if (!isWorthShowing(savings)) continue

      alternatives.push({
        candidate,
        walkingRoute,
        fareEstimates,
        bestFare,
        directFare: bestDirectFare,
        savings,
        score,
        isRecommended: false, // set below
      })
    }

    // 8. Sort by score ascending (lower = better)
    alternatives.sort((a, b) => a.score - b.score)

    // 10. Mark the best-score option as recommended
    if (alternatives.length > 0) {
      alternatives[0].isRecommended = true
    }

    const maxSavings = alternatives.length > 0 ? alternatives[0].savings : 0

    // 11. Save search to Supabase (fire-and-forget)
    const ipHash = await hashIp(ip)
    saveSearch({
      pickup,
      destination,
      pickup_lat: pickupGeo.lat,
      pickup_lng: pickupGeo.lng,
      dest_lat: destGeo.lat,
      dest_lng: destGeo.lng,
      direct_price: bestDirectFare.price,
      best_price: alternatives[0]?.bestFare.price,
      savings: maxSavings,
      walking_minutes: maxWalkingMinutes,
      provider: providerNames.join(','),
      ip_hash: ipHash,
    }).catch((err) => console.error('[Supabase] save search error:', err))

    // 12. Return results
    const result: SearchResult = {
      pickup: {
        lat: pickupGeo.lat,
        lng: pickupGeo.lng,
        label: pickupGeo.label,
      },
      destination: {
        lat: destGeo.lat,
        lng: destGeo.lng,
        label: destGeo.label,
      },
      directFares,
      bestDirectFare,
      alternatives,
      bestAlternative: alternatives[0] ?? null,
      maxSavings,
      walkingMinutes: maxWalkingMinutes,
      rateLimitRemaining: rateLimit.remaining,
    }

    return NextResponse.json(result, {
      headers: {
        'X-RateLimit-Remaining': rateLimit.remaining.toString(),
        'X-RateLimit-Reset': rateLimit.resetAt.toISOString(),
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    console.error('[Search API] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
