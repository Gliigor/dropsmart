/**
 * Shared types for DropSmart.
 */

export interface Coordinates {
  lat: number
  lng: number
}

export interface Place extends Coordinates {
  label: string
}

export type ProviderId = 'uber' | 'bolt'

export type WalkMinutes = 3 | 5 | 10 | 15

export interface SearchRequest {
  pickup: string
  destination: string
  maxWalkingMinutes: WalkMinutes
  provider: ProviderId
  /** Real fare (€) the user sees in the app for the direct ride. Calibrates every estimate. */
  directQuote?: number
  /** What an hour of the user's time is worth (€). Default 15. */
  valueOfTimePerHour?: number
}

/** Walking route between a drop-off and the destination. */
export interface WalkingRoute {
  durationMinutes: number
  distanceMeters: number
  /** GeoJSON-order coordinates [[lng, lat], ...] */
  polyline: [number, number][]
}

/** One alternative drop-off point, fully evaluated against the direct ride. */
export interface Option {
  id: string
  label: string
  /** Compass direction from the destination (N, NE, ...) */
  direction: string
  lat: number
  lng: number
  distanceFromDestM: number
  /** Estimated fare to this drop-off (calibrated to the user's quote when given) */
  fare: number
  /** Direct fare − this fare */
  savings: number
  driveMinutes: number
  walkMinutes: number
  walkMeters: number
  /** (drive + walk) − (direct drive + direct walk). Negative means it is faster overall. */
  extraMinutes: number
  /** extraMinutes × value of time */
  timeCost: number
  /** savings − timeCost. Only positive means walking actually wins. */
  net: number
  walkPolyline: [number, number][]
}

export type Verdict = 'walk' | 'ride'

export interface SearchResult {
  pickup: Place
  destination: Place
  provider: ProviderId
  direct: {
    fare: number
    driveMinutes: number
    driveKm: number
    /** Walk from where a car can actually stop to the destination (usually 0) */
    walkMinutes: number
    fareSource: 'quote' | 'model'
  }
  /** Set when the user supplied a real quote; estimates are scaled by `multiplier`. */
  calibration: { quote: number; multiplier: number } | null
  valueOfTimePerMin: number
  verdict: Verdict
  /** The best option by net benefit (may be a loss when verdict is 'ride'). */
  best: Option | null
  /** Top options by net benefit, best first. */
  options: Option[]
  routingSource: 'osrm' | 'estimated'
  walkingSource: 'ors' | 'estimated'
  warnings: string[]
  rateLimitRemaining: number
}

export interface ApiError {
  error: string
  code?: string
  remaining?: number
}

export interface AdminStats {
  totalSearchesToday: number
  totalSearchesWeek: number
  totalSearchesAllTime: number
  averageSavings: number
  largestSaving: number
  topDestinations: { destination: string; count: number }[]
}
