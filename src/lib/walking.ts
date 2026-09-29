/**
 * OpenRouteService walking route calculations.
 *
 * ORS provides free walking routes including duration, distance, and polyline.
 * API key required (free tier: 2000 requests/day).
 * Sign up at: https://openrouteservice.org/
 */

import type { Coordinates, WalkingRoute } from '@/providers/types'

const ORS_BASE = 'https://api.openrouteservice.org/v2/directions/foot-walking'

interface OrsResponse {
  routes: {
    summary: {
      duration: number // seconds
      distance: number // meters
    }
    geometry: string // encoded polyline
  }[]
  bbox?: number[]
  metadata?: Record<string, unknown>
}

interface OrsErrorResponse {
  error?: {
    code?: number
    message?: string
  }
  message?: string
}

/**
 * Decode an ORS-encoded polyline (Google Polyline Algorithm, precision 5).
 * Returns array of [lng, lat] coordinate pairs for GeoJSON compatibility.
 */
function decodePolyline(encoded: string): [number, number][] {
  const coords: [number, number][] = []
  let index = 0
  let lat = 0
  let lng = 0

  while (index < encoded.length) {
    let result = 0
    let shift = 0
    let b: number

    do {
      b = encoded.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)

    const dlat = result & 1 ? ~(result >> 1) : result >> 1
    lat += dlat

    result = 0
    shift = 0

    do {
      b = encoded.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)

    const dlng = result & 1 ? ~(result >> 1) : result >> 1
    lng += dlng

    coords.push([lng / 1e5, lat / 1e5])
  }

  return coords
}

/**
 * Get a walking route between two points using OpenRouteService.
 *
 * @param from - Start coordinate (e.g. alternative drop-off point)
 * @param to - End coordinate (final destination)
 * @returns Walking route with duration, distance, and polyline
 * @throws If ORS request fails or no route found
 */
export async function getWalkingRoute(
  from: Coordinates,
  to: Coordinates
): Promise<WalkingRoute> {
  const apiKey = process.env.ORS_API_KEY

  if (!apiKey) {
    // Fallback: straight-line estimate when no API key configured
    return estimateWalkingRoute(from, to)
  }

  const body = {
    coordinates: [
      [from.lng, from.lat],
      [to.lng, to.lat],
    ],
    instructions: false,
    geometry: true,
  }

  const res = await fetch(ORS_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: apiKey,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errBody = (await res.json().catch(() => ({}))) as OrsErrorResponse
    const msg = errBody?.error?.message ?? errBody?.message ?? res.statusText
    throw new Error(`ORS walking route failed: ${res.status} — ${msg}`)
  }

  const data = (await res.json()) as OrsResponse

  if (!data.routes || data.routes.length === 0) {
    throw new Error('ORS returned no walking routes')
  }

  const route = data.routes[0]
  const polyline = decodePolyline(route.geometry)

  return {
    durationMinutes: Math.round(route.summary.duration / 60),
    distanceMeters: Math.round(route.summary.distance),
    polyline,
  }
}

/**
 * Fallback straight-line walking estimate when ORS is unavailable.
 * Walking speed: ~80 meters/minute (4.8 km/h).
 */
function estimateWalkingRoute(from: Coordinates, to: Coordinates): WalkingRoute {
  const EARTH_R = 6371000
  const RAD = Math.PI / 180

  const dLat = (to.lat - from.lat) * RAD
  const dLng = (to.lng - from.lng) * RAD
  const lat1 = from.lat * RAD
  const lat2 = to.lat * RAD

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2

  const distanceM = 2 * EARTH_R * Math.asin(Math.sqrt(h))

  // Add 25% for real walking paths vs straight line
  const routedDistanceM = distanceM * 1.25
  const durationMinutes = Math.round(routedDistanceM / 80)

  return {
    durationMinutes,
    distanceMeters: Math.round(routedDistanceM),
    // Straight line polyline: just start and end
    polyline: [
      [from.lng, from.lat],
      [to.lng, to.lat],
    ],
  }
}

/**
 * Get walking routes for multiple candidates in parallel with ORS rate limiting.
 * ORS free tier: 40 requests/minute. We process up to 10 concurrently.
 */
export async function getWalkingRoutes(
  from: Coordinates,
  destinations: Coordinates[]
): Promise<(WalkingRoute | null)[]> {
  const CONCURRENCY = 10

  const results: (WalkingRoute | null)[] = new Array(destinations.length).fill(null)

  for (let i = 0; i < destinations.length; i += CONCURRENCY) {
    const batch = destinations.slice(i, i + CONCURRENCY)
    const batchResults = await Promise.all(
      batch.map(async (dest): Promise<WalkingRoute | null> => {
        try {
          return await getWalkingRoute(from, dest)
        } catch {
          return null
        }
      })
    )
    batchResults.forEach((r, j) => {
      results[i + j] = r
    })
  }

  return results
}
