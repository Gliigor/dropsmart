/**
 * Fare model.
 *
 * Uber and Bolt have no public price API, so a fare is modelled as
 *   max(minFare, base + perKm × km + perMin × minutes)
 * using the real driving distance and duration of the route.
 *
 * The rates below are UNVERIFIED defaults for Amsterdam — they are only as good as
 * the last time someone checked them against the app. That is why the app lets the
 * user type in the real quote for their direct ride: `calibrationMultiplier` then
 * scales every estimate so it matches reality (this also captures surge, which is a
 * multiplier on the whole fare).
 */

import type { ProviderId } from './types'

export interface FareProfile {
  name: string
  base: number
  perKm: number
  perMin: number
  minFare: number
}

export const FARE_PROFILES: Record<ProviderId, FareProfile> = {
  uber: { name: 'Uber', base: 2.5, perKm: 1.2, perMin: 0.2, minFare: 5.0 },
  bolt: { name: 'Bolt', base: 1.8, perKm: 0.95, perMin: 0.15, minFare: 4.0 },
}

export interface RideMetrics {
  km: number
  minutes: number
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function modelFare(profile: FareProfile, ride: RideMetrics): number {
  const raw = profile.base + profile.perKm * ride.km + profile.perMin * ride.minutes
  return round2(Math.max(profile.minFare, raw))
}

/** Keep a single typo (or a surge screenshot from another city) from wrecking every estimate. */
const MIN_MULTIPLIER = 0.5
const MAX_MULTIPLIER = 4

/**
 * Ratio between what the app really charges and what the model predicts for the
 * same ride. Returns null when the inputs cannot produce a usable ratio.
 */
export function calibrationMultiplier(quote: number, modelled: number): number | null {
  if (!Number.isFinite(quote) || !Number.isFinite(modelled) || quote <= 0 || modelled <= 0) {
    return null
  }
  return Math.min(MAX_MULTIPLIER, Math.max(MIN_MULTIPLIER, quote / modelled))
}

export function scaleFare(modelled: number, multiplier: number): number {
  return round2(modelled * multiplier)
}
