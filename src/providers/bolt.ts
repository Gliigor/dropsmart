/**
 * Bolt Amsterdam fare adapter.
 *
 * Pricing (Amsterdam, 2024):
 *   Base fare:  €1.80
 *   Per km:     €0.95
 *   Per minute: €0.15
 *
 * Distance and duration are calculated using the Haversine formula.
 * When Bolt releases a public API, replace getFareEstimate with a real HTTP call
 * while keeping the same interface signature — no calling code changes required.
 */

import type { Coordinates, FareEstimate, FareProvider } from './types'

const BASE_FARE = 1.8
const RATE_PER_KM = 0.95
const RATE_PER_MIN = 0.15
const AVG_SPEED_KMH = 25 // average city driving speed

/**
 * Haversine distance in kilometers between two lat/lng points.
 */
function haversineKm(a: Coordinates, b: Coordinates): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180

  const hav =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2

  return 2 * R * Math.asin(Math.sqrt(hav))
}

export class BoltAdapter implements FareProvider {
  name = 'Bolt'

  async getFareEstimate(
    pickup: Coordinates,
    dropoff: Coordinates
  ): Promise<FareEstimate> {
    const distanceKm = haversineKm(pickup, dropoff)
    // Add ~30% overhead for city routing vs straight-line distance
    const routedKm = distanceKm * 1.3
    const durationMinutes = (routedKm / AVG_SPEED_KMH) * 60

    const price = BASE_FARE + routedKm * RATE_PER_KM + durationMinutes * RATE_PER_MIN

    return {
      price: Math.round(price * 100) / 100,
      currency: 'EUR',
      isEstimated: true,
      provider: this.name,
      durationMinutes: Math.round(durationMinutes),
      distanceKm: Math.round(routedKm * 100) / 100,
    }
  }
}
