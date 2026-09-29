/**
 * Candidate drop-off point generation.
 *
 * Strategy: Generate points in concentric rings around the destination,
 * using cardinal (N/S/E/W) and intercardinal (NE/SE/SW/NW) directions.
 *
 * Walking time → radius → point count mapping:
 *   3 min  → ~250m radius  → 6 points
 *   5 min  → ~400m radius  → 8 points
 *   10 min → ~800m radius  → 12 points
 *   15 min → ~1200m radius → 16 points
 *
 * For larger radii, we generate points at both 60% and 100% of the radius
 * to fill in the search space and give ORS more options to filter.
 */

import type { Coordinates, CandidatePoint } from '@/providers/types'
import { reverseGeocode } from './geocoding'

/** Earth radius in meters */
const EARTH_RADIUS_M = 6371000

/** Degrees per radian */
const RAD = Math.PI / 180

/** Config: walking speed ~80m/min, but we use 60m/min for conservative radius */
const WALK_SPEED_M_PER_MIN = 70

/**
 * Walking time presets with radii and point counts.
 * Multiple rings (radii) let us cover the search space better.
 */
const WALK_CONFIG: Record<
  number,
  { radii: number[]; directions: number[] }
> = {
  3: {
    radii: [200, 280],
    directions: [0, 60, 120, 180, 240, 300], // 6 directions (hexagonal)
  },
  5: {
    radii: [280, 420],
    directions: [0, 45, 90, 135, 180, 225, 270, 315], // 8 directions
  },
  10: {
    radii: [400, 650, 850],
    directions: [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330], // 12 directions
  },
  15: {
    radii: [500, 800, 1100, 1300],
    directions: [0, 22.5, 45, 67.5, 90, 112.5, 135, 157.5, 180, 202.5, 225, 247.5, 270, 292.5, 315, 337.5], // 16 directions
  },
}

/** Direction labels for human-readable output */
function bearingToLabel(bearing: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  const index = Math.round(bearing / 45) % 8
  return dirs[index]
}

/**
 * Offset a coordinate by a distance in meters at a given bearing (degrees from north).
 * Uses the spherical Earth model.
 */
function offsetCoordinate(
  origin: Coordinates,
  distanceM: number,
  bearingDeg: number
): Coordinates {
  const d = distanceM / EARTH_RADIUS_M
  const bearing = bearingDeg * RAD
  const lat1 = origin.lat * RAD
  const lng1 = origin.lng * RAD

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(bearing)
  )
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
    )

  return {
    lat: lat2 / RAD,
    lng: lng2 / RAD,
  }
}

/**
 * Straight-line distance in meters between two coordinates.
 */
export function distanceMeters(a: Coordinates, b: Coordinates): number {
  const dLat = (b.lat - a.lat) * RAD
  const dLng = (b.lng - a.lng) * RAD
  const lat1 = a.lat * RAD
  const lat2 = b.lat * RAD

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2

  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h))
}

/**
 * Generate candidate drop-off points around a destination.
 *
 * @param destination - The final destination coordinates
 * @param maxWalkingMinutes - Maximum walking time the user accepts
 * @returns Array of candidate points with labels (reverse geocoded)
 */
export async function generateCandidates(
  destination: Coordinates,
  maxWalkingMinutes: number
): Promise<CandidatePoint[]> {
  const config = WALK_CONFIG[maxWalkingMinutes] ?? WALK_CONFIG[10]
  const maxRadiusM = maxWalkingMinutes * WALK_SPEED_M_PER_MIN

  const pointsToGenerate: Coordinates[] = []
  const seenKeys = new Set<string>()

  for (const radius of config.radii) {
    if (radius > maxRadiusM * 1.1) continue // don't generate beyond max walk distance

    for (const bearing of config.directions) {
      const point = offsetCoordinate(destination, radius, bearing)
      // Deduplicate near-identical points
      const key = `${point.lat.toFixed(4)},${point.lng.toFixed(4)}`
      if (!seenKeys.has(key)) {
        seenKeys.add(key)
        pointsToGenerate.push(point)
      }
    }
  }

  // Reverse geocode all candidates in parallel (with rate limiting)
  // Nominatim allows max 1 req/sec — batch with small delays
  const candidates: CandidatePoint[] = []

  // Process in batches of 4 with 250ms delay between batches
  const BATCH_SIZE = 4
  const BATCH_DELAY_MS = 300

  for (let i = 0; i < pointsToGenerate.length; i += BATCH_SIZE) {
    const batch = pointsToGenerate.slice(i, i + BATCH_SIZE)

    const batchResults = await Promise.all(
      batch.map(async (point) => {
        const label = await reverseGeocode(point)
        const distanceFromDest = distanceMeters(destination, point)
        const bearing = config.directions[pointsToGenerate.indexOf(point) % config.directions.length]

        return {
          lat: point.lat,
          lng: point.lng,
          label,
          distanceFromDest,
          direction: bearingToLabel(bearing),
        } satisfies CandidatePoint
      })
    )

    candidates.push(...batchResults)

    // Rate limit: wait between batches (except the last)
    if (i + BATCH_SIZE < pointsToGenerate.length) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS))
    }
  }

  return candidates
}
