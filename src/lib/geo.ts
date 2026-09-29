/**
 * Small geodesy helpers shared across the app.
 */

import type { Coordinates } from './types'

const EARTH_RADIUS_M = 6371000
const RAD = Math.PI / 180

/** Great-circle distance in meters. */
export function distanceMeters(a: Coordinates, b: Coordinates): number {
  const dLat = (b.lat - a.lat) * RAD
  const dLng = (b.lng - a.lng) * RAD
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h))
}

/** Initial bearing in degrees [0, 360) from `a` to `b`. */
export function bearingDegrees(a: Coordinates, b: Coordinates): number {
  const dLng = (b.lng - a.lng) * RAD
  const lat1 = a.lat * RAD
  const lat2 = b.lat * RAD
  const y = Math.sin(dLng) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng)
  return (Math.atan2(y, x) / RAD + 360) % 360
}

/** Point `distanceM` away from `origin` along `bearingDeg`. */
export function offsetCoordinate(
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
  return { lat: lat2 / RAD, lng: lng2 / RAD }
}

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']

export function bearingToCompass(bearing: number): string {
  return COMPASS[Math.round((((bearing % 360) + 360) % 360) / 45) % 8]
}
