/**
 * Shared types for the DropSmart fare estimation system.
 * Designed to be provider-agnostic so real APIs can be plugged in later.
 */

/** Geographic coordinate pair */
export interface Coordinates {
  lat: number
  lng: number
}

/**
 * Fare estimate returned by any FareProvider.
 * isEstimated is always `true` for calculated estimates (Uber/Bolt have no public APIs).
 * When real APIs are integrated, isEstimated becomes false.
 */
export interface FareEstimate {
  price: number
  currency: string
  isEstimated: true
  provider: string
  durationMinutes: number
  distanceKm: number
}

/**
 * The FareProvider interface that all adapters must implement.
 * Uber and Bolt adapters use formula-based estimation.
 * Future adapters can call real APIs with no changes to calling code.
 */
export interface FareProvider {
  name: string
  getFareEstimate(pickup: Coordinates, dropoff: Coordinates): Promise<FareEstimate>
}

/** A candidate drop-off point with geocoded label */
export interface CandidatePoint {
  lat: number
  lng: number
  label: string
  /** Distance from final destination in meters */
  distanceFromDest: number
  /** Direction label (N, NE, E, SE, S, SW, W, NW) */
  direction: string
}

/** Walking route from ORS */
export interface WalkingRoute {
  durationMinutes: number
  distanceMeters: number
  /** GeoJSON LineString coordinates [[lng, lat], ...] */
  polyline: [number, number][]
}

/** A complete alternative drop-off option */
export interface Alternative {
  candidate: CandidatePoint
  walkingRoute: WalkingRoute
  fareEstimates: FareEstimate[]
  /** The best (lowest) fare across all providers */
  bestFare: FareEstimate
  /** The direct fare to original destination */
  directFare: FareEstimate
  /** Monetary savings vs direct ride */
  savings: number
  /** Combined score: rideCost + walkingMinutes × walkingCostPerMin */
  score: number
  /** Recommended = lowest score among all alternatives */
  isRecommended: boolean
}

/** The complete search result returned by the API */
export interface SearchResult {
  pickup: Coordinates & { label: string }
  destination: Coordinates & { label: string }
  /** Direct fare to destination (no walking) */
  directFares: FareEstimate[]
  bestDirectFare: FareEstimate
  alternatives: Alternative[]
  /** Best alternative (lowest score) */
  bestAlternative: Alternative | null
  /** Max potential savings */
  maxSavings: number
  walkingMinutes: number
  rateLimitRemaining: number
}

/** The request body for the search API */
export interface SearchRequest {
  pickup: string
  destination: string
  maxWalkingMinutes: 3 | 5 | 10 | 15
  provider?: 'uber' | 'bolt' | 'both'
}

/** Admin stats shape */
export interface AdminStats {
  totalSearchesToday: number
  totalSearchesWeek: number
  totalSearchesAllTime: number
  averageSavings: number
  largestSaving: number
  topDestinations: { destination: string; count: number }[]
}

/** API error response */
export interface ApiError {
  error: string
  code?: string
  remaining?: number
}
