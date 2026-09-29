/**
 * Nominatim geocoding functions.
 * Nominatim is the OpenStreetMap geocoder — free, no API key required.
 * Terms of use: max 1 req/sec, must set User-Agent header.
 */

import type { Coordinates } from '@/providers/types'

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org'
const USER_AGENT = 'WalkForSavings/1.0 (https://gligor.xyz)'

export interface GeocodedLocation {
  lat: number
  lng: number
  label: string
  boundingBox?: [number, number, number, number]
}

/**
 * Forward geocode: address string → coordinates.
 * Returns the top result from Nominatim.
 */
export async function geocodeAddress(query: string): Promise<GeocodedLocation> {
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    limit: '1',
    addressdetails: '1',
  })

  const res = await fetch(`${NOMINATIM_BASE}/search?${params}`, {
    headers: { 'User-Agent': USER_AGENT },
    next: { revalidate: 3600 }, // cache geocoding results for 1 hour
  })

  if (!res.ok) {
    throw new Error(`Nominatim geocoding failed: ${res.status} ${res.statusText}`)
  }

  const results = (await res.json()) as NominatimSearchResult[]

  if (results.length === 0) {
    throw new Error(`No location found for: "${query}"`)
  }

  const r = results[0]
  return {
    lat: parseFloat(r.lat),
    lng: parseFloat(r.lon),
    label: r.display_name,
    boundingBox: r.boundingbox
      ? [
          parseFloat(r.boundingbox[0]),
          parseFloat(r.boundingbox[1]),
          parseFloat(r.boundingbox[2]),
          parseFloat(r.boundingbox[3]),
        ]
      : undefined,
  }
}

/**
 * Reverse geocode: coordinates → human-readable address.
 * Returns a short street name + house number when available.
 */
export async function reverseGeocode(coords: Coordinates): Promise<string> {
  const params = new URLSearchParams({
    lat: coords.lat.toString(),
    lon: coords.lng.toString(),
    format: 'json',
    zoom: '17', // street level
    addressdetails: '1',
  })

  try {
    const res = await fetch(`${NOMINATIM_BASE}/reverse?${params}`, {
      headers: { 'User-Agent': USER_AGENT },
      next: { revalidate: 86400 }, // cache reverse geocoding for 24 hours
    })

    if (!res.ok) {
      return `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`
    }

    const result = (await res.json()) as NominatimReverseResult

    if (result.error) {
      return `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`
    }

    // Build a short human-friendly label
    const addr = result.address
    const parts: string[] = []

    if (addr.road) parts.push(addr.road)
    if (addr.house_number) parts.push(addr.house_number)
    if (parts.length === 0 && addr.neighbourhood) parts.push(addr.neighbourhood)
    if (parts.length === 0 && addr.suburb) parts.push(addr.suburb)

    return parts.length > 0 ? parts.join(' ') : result.display_name.split(',')[0]
  } catch {
    return `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`
  }
}

// ---- Nominatim response types ----

interface NominatimSearchResult {
  lat: string
  lon: string
  display_name: string
  boundingbox?: string[]
}

interface NominatimReverseResult {
  lat: string
  lon: string
  display_name: string
  error?: string
  address: {
    road?: string
    house_number?: string
    neighbourhood?: string
    suburb?: string
    city?: string
    postcode?: string
    country?: string
  }
}
