/**
 * Routing clients.
 *
 * Driving: OSRM `table` service — one request gives real road distance and duration
 *          from the pickup to every candidate, AND the nearest drivable point for each
 *          (a car cannot stop in a canal or a park, so we snap to the road network).
 * Walking: OpenRouteService matrix (one request) + directions (polyline for the top picks).
 *
 * Both fall back to straight-line estimates so a provider outage degrades the answer
 * instead of breaking it; callers are told which source was used.
 */

import { distanceMeters } from './geo'
import type { Coordinates, WalkingRoute } from './types'

const OSRM_BASE = process.env.OSRM_URL ?? 'https://router.project-osrm.org'
const ORS_BASE = 'https://api.openrouteservice.org/v2'
const REQUEST_TIMEOUT_MS = 8000

/** Nearest road further away than this means the point is not reachable by car. */
export const MAX_SNAP_METERS = 150

const DRIVE_DETOUR_FACTOR = 1.3
const DRIVE_SPEED_KMH = 25
const WALK_DETOUR_FACTOR = 1.25
const WALK_METERS_PER_MIN = 80

export interface DriveLeg {
  minutes: number
  km: number
  /** Where a car would actually stop (nearest drivable point). */
  snapped: Coordinates
  snapMeters: number
}

export interface WalkLeg {
  minutes: number
  meters: number
}

function timeoutSignal(): AbortSignal {
  return AbortSignal.timeout(REQUEST_TIMEOUT_MS)
}

/** Straight-line driving estimate (used when OSRM is unavailable). */
export function estimateDrive(from: Coordinates, to: Coordinates): DriveLeg {
  const km = (distanceMeters(from, to) / 1000) * DRIVE_DETOUR_FACTOR
  return { km, minutes: (km / DRIVE_SPEED_KMH) * 60, snapped: to, snapMeters: 0 }
}

/** Straight-line walking estimate (used when ORS is unavailable). */
export function estimateWalk(from: Coordinates, to: Coordinates): WalkLeg {
  const meters = distanceMeters(from, to) * WALK_DETOUR_FACTOR
  return { meters, minutes: meters / WALK_METERS_PER_MIN }
}

interface OsrmTableResponse {
  code: string
  durations?: (number | null)[][]
  distances?: (number | null)[][]
  destinations?: { location: [number, number] }[]
}

/**
 * Driving legs from `pickup` to each of `points`, in order. Unroutable points are null.
 * Throws if OSRM is unreachable or answers with an error.
 */
export async function driveLegs(
  pickup: Coordinates,
  points: Coordinates[]
): Promise<(DriveLeg | null)[]> {
  const coords = [pickup, ...points].map((c) => `${c.lng.toFixed(6)},${c.lat.toFixed(6)}`).join(';')
  const destinations = points.map((_, i) => i + 1).join(';')
  const url = `${OSRM_BASE}/table/v1/driving/${coords}?sources=0&destinations=${destinations}&annotations=duration,distance`

  const res = await fetch(url, { signal: timeoutSignal() })
  if (!res.ok) throw new Error(`OSRM request failed: ${res.status}`)
  const data = (await res.json()) as OsrmTableResponse
  if (data.code !== 'Ok' || !data.durations?.[0] || !data.distances?.[0] || !data.destinations) {
    throw new Error(`OSRM error: ${data.code}`)
  }

  return points.map((requested, i) => {
    const seconds = data.durations![0][i]
    const meters = data.distances![0][i]
    const snap = data.destinations![i]?.location
    if (seconds == null || meters == null || !snap) return null
    const snapped = { lat: snap[1], lng: snap[0] }
    return {
      minutes: seconds / 60,
      km: meters / 1000,
      snapped,
      snapMeters: distanceMeters(requested, snapped),
    }
  })
}

interface OrsMatrixResponse {
  durations?: (number | null)[][]
  distances?: (number | null)[][]
}

/**
 * Walking legs from each of `sources` to `destination`, in order.
 * `source` says whether real routing was used or the straight-line fallback.
 */
export async function walkLegs(
  sources: Coordinates[],
  destination: Coordinates
): Promise<{ legs: WalkLeg[]; source: 'ors' | 'estimated' }> {
  const fallback = () => ({
    legs: sources.map((s) => estimateWalk(s, destination)),
    source: 'estimated' as const,
  })

  const apiKey = process.env.ORS_API_KEY
  if (!apiKey) return fallback()

  try {
    const res = await fetch(`${ORS_BASE}/matrix/foot-walking`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: apiKey },
      body: JSON.stringify({
        locations: [...sources, destination].map((c) => [c.lng, c.lat]),
        sources: sources.map((_, i) => i),
        destinations: [sources.length],
        metrics: ['duration', 'distance'],
      }),
      signal: timeoutSignal(),
    })
    if (!res.ok) return fallback()
    const data = (await res.json()) as OrsMatrixResponse
    if (!data.durations || !data.distances) return fallback()

    const legs = sources.map((s, i) => {
      const seconds = data.durations![i]?.[0]
      const meters = data.distances![i]?.[0]
      return seconds == null || meters == null
        ? estimateWalk(s, destination)
        : { minutes: seconds / 60, meters }
    })
    return { legs, source: 'ors' }
  } catch {
    return fallback()
  }
}

/** Decode a Google-style encoded polyline (precision 5) into [lng, lat] pairs. */
export function decodePolyline(encoded: string): [number, number][] {
  const coords: [number, number][] = []
  let index = 0
  let lat = 0
  let lng = 0

  const readValue = (): number => {
    let result = 0
    let shift = 0
    let b: number
    do {
      b = encoded.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    return result & 1 ? ~(result >> 1) : result >> 1
  }

  while (index < encoded.length) {
    lat += readValue()
    lng += readValue()
    coords.push([lng / 1e5, lat / 1e5])
  }
  return coords
}

/** Walking route with a drawable polyline; falls back to a straight line. */
export async function walkingRoute(from: Coordinates, to: Coordinates): Promise<WalkingRoute> {
  const straight = (): WalkingRoute => {
    const leg = estimateWalk(from, to)
    return {
      durationMinutes: Math.round(leg.minutes),
      distanceMeters: Math.round(leg.meters),
      polyline: [
        [from.lng, from.lat],
        [to.lng, to.lat],
      ],
    }
  }

  const apiKey = process.env.ORS_API_KEY
  if (!apiKey) return straight()

  try {
    const res = await fetch(`${ORS_BASE}/directions/foot-walking`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: apiKey },
      body: JSON.stringify({
        coordinates: [
          [from.lng, from.lat],
          [to.lng, to.lat],
        ],
        instructions: false,
      }),
      signal: timeoutSignal(),
    })
    if (!res.ok) return straight()
    const data = (await res.json()) as {
      routes?: { summary: { duration: number; distance: number }; geometry: string }[]
    }
    const route = data.routes?.[0]
    if (!route) return straight()
    return {
      durationMinutes: Math.round(route.summary.duration / 60),
      distanceMeters: Math.round(route.summary.distance),
      polyline: decodePolyline(route.geometry),
    }
  } catch {
    return straight()
  }
}
