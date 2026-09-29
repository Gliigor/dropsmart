/**
 * Search pipeline: geocode → candidates → real driving routes (snapped to roads)
 * → walking routes → fares → net benefit → verdict.
 */

import { compassFor, generateCandidates } from './candidates'
import {
  DEFAULT_VALUE_OF_TIME_PER_HOUR,
  evaluateOption,
  isWorthWalking,
  type JourneyLeg,
} from './decision'
import { FARE_PROFILES, calibrationMultiplier, modelFare, scaleFare } from './fare'
import { geocodeAddress, reverseGeocode } from './geocoding'
import { distanceMeters } from './geo'
import {
  MAX_SNAP_METERS,
  driveLegs,
  estimateDrive,
  walkLegs,
  walkingRoute,
  type DriveLeg,
} from './routing'
import type { Coordinates, Option, SearchRequest, SearchResult } from './types'

/** How many options are returned (each costs a reverse-geocode, which Nominatim rate-limits). */
const MAX_OPTIONS = 3

/** A "different" drop-off must be at least this far from where the direct ride would stop. */
const MIN_SEPARATION_M = 80

export class SearchError extends Error {
  constructor(
    message: string,
    public status: number = 500
  ) {
    super(message)
  }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

function key(c: Coordinates): string {
  return `${c.lat.toFixed(5)},${c.lng.toFixed(5)}`
}

function rethrowAsUserError(err: unknown): never {
  const message = err instanceof Error ? err.message : 'Geocoding failed'
  // "No location found" is the user's input; anything else is an upstream failure
  throw new SearchError(message, message.startsWith('No location found') ? 422 : 502)
}

export async function runSearch(
  req: SearchRequest
): Promise<Omit<SearchResult, 'rateLimitRemaining'>> {
  const warnings: string[] = []
  const profile = FARE_PROFILES[req.provider]
  const valueOfTimePerMin = (req.valueOfTimePerHour ?? DEFAULT_VALUE_OF_TIME_PER_HOUR) / 60

  // 1. Geocode (Nominatim calls are queued to respect its 1 req/s policy)
  const pickup = await geocodeAddress(req.pickup).catch(rethrowAsUserError)
  const destination = await geocodeAddress(req.destination).catch(rethrowAsUserError)

  // 2. Candidates on the pickup-facing side of the destination
  const raw = generateCandidates(pickup, destination, req.maxWalkingMinutes)

  // 3. Real driving legs for the destination itself + every candidate
  const points: Coordinates[] = [destination, ...raw]
  let routingSource: 'osrm' | 'estimated' = 'osrm'
  let drives: (DriveLeg | null)[]
  try {
    drives = await driveLegs(pickup, points)
  } catch {
    routingSource = 'estimated'
    drives = points.map((p) => estimateDrive(pickup, p))
    warnings.push(
      'Live road routing is unavailable, so distances are straight-line estimates and drop-off points are not snapped to roads. Treat results as rough.'
    )
  }

  const directDrive = drives[0]
  if (!directDrive) {
    throw new SearchError('No drivable route found from the pickup to that destination.', 422)
  }

  // 4. Keep candidates a car can reach, de-duplicated after snapping to the road network
  const seen = new Set<string>([key(directDrive.snapped)])
  const usable: { drive: DriveLeg; bearing: number }[] = []
  raw.forEach((c, i) => {
    const drive = drives[i + 1]
    if (!drive || drive.snapMeters > MAX_SNAP_METERS) return
    if (distanceMeters(drive.snapped, directDrive.snapped) < MIN_SEPARATION_M) return
    const k = key(drive.snapped)
    if (seen.has(k)) return
    seen.add(k)
    usable.push({ drive, bearing: c.bearing })
  })

  // 5. Walking legs: from where the direct ride stops, and from every candidate
  const { legs: walks, source: walkingSource } = await walkLegs(
    [directDrive.snapped, ...usable.map((u) => u.drive.snapped)],
    destination
  )
  if (walkingSource === 'estimated') {
    warnings.push('Walking times are straight-line estimates (no walking-route service configured).')
  }

  // 6. Fares: model, calibrated to the user's real quote when given
  const modelDirect = modelFare(profile, { km: directDrive.km, minutes: directDrive.minutes })
  const quote = req.directQuote && req.directQuote > 0 ? req.directQuote : null
  const multiplier = quote ? calibrationMultiplier(quote, modelDirect) : null
  const calibration = quote && multiplier ? { quote, multiplier } : null
  if (calibration && (calibration.multiplier <= 0.5 || calibration.multiplier >= 4)) {
    warnings.push(
      `Your quote is very different from what we expect for this route, so estimates were scaled by ×${calibration.multiplier.toFixed(1)} (the limit). Double-check the amount.`
    )
  }
  const fareFor = (drive: DriveLeg) => {
    const modelled = modelFare(profile, { km: drive.km, minutes: drive.minutes })
    return calibration ? scaleFare(modelled, calibration.multiplier) : modelled
  }

  const directWalkMinutes = walks[0].minutes < 0.5 ? 0 : walks[0].minutes
  const directLeg: JourneyLeg = {
    fare: calibration ? calibration.quote : modelDirect,
    driveMinutes: directDrive.minutes,
    walkMinutes: directWalkMinutes,
  }

  // 7. Evaluate every option against the direct ride
  const evaluated: Option[] = []
  usable.forEach((u, i) => {
    const walk = walks[i + 1]
    if (walk.minutes > req.maxWalkingMinutes) return
    const fare = fareFor(u.drive)
    const ev = evaluateOption(
      directLeg,
      { fare, driveMinutes: u.drive.minutes, walkMinutes: walk.minutes },
      valueOfTimePerMin
    )
    if (ev.savings <= 0) return
    evaluated.push({
      id: key(u.drive.snapped),
      label: `${u.drive.snapped.lat.toFixed(4)}, ${u.drive.snapped.lng.toFixed(4)}`,
      direction: compassFor(u.bearing),
      lat: u.drive.snapped.lat,
      lng: u.drive.snapped.lng,
      distanceFromDestM: Math.round(distanceMeters(u.drive.snapped, destination)),
      fare,
      savings: ev.savings,
      driveMinutes: round1(u.drive.minutes),
      walkMinutes: round1(walk.minutes),
      walkMeters: Math.round(walk.meters),
      extraMinutes: ev.extraMinutes,
      timeCost: ev.timeCost,
      net: ev.net,
      walkPolyline: [],
    })
  })

  evaluated.sort((a, b) => b.net - a.net)
  const options = evaluated.slice(0, MAX_OPTIONS)

  // 8. Only the shown options get street names and walking geometry
  const routes = await Promise.all(options.map((o) => walkingRoute(o, destination)))
  options.forEach((o, i) => (o.walkPolyline = routes[i].polyline))
  for (const o of options) {
    o.label = await reverseGeocode(o)
  }

  const best = options[0] ?? null
  return {
    pickup,
    destination,
    provider: req.provider,
    direct: {
      fare: directLeg.fare,
      driveMinutes: round1(directDrive.minutes),
      driveKm: round1(directDrive.km),
      walkMinutes: round1(directWalkMinutes),
      fareSource: calibration ? 'quote' : 'model',
    },
    calibration,
    valueOfTimePerMin,
    verdict: best && isWorthWalking(best.net) ? 'walk' : 'ride',
    best,
    options,
    routingSource,
    walkingSource,
    warnings,
  }
}
