'use client'

/**
 * ResultCard component.
 * Shows a single alternative drop-off option with fare, walking info, savings,
 * and deep links to open Uber/Bolt with the drop-off pre-filled.
 */

import type { Alternative, FareEstimate, Coordinates } from '@/providers/types'

interface ResultCardProps {
  alternative: Alternative
  isRecommended?: boolean
  directFare: FareEstimate
  pickup: Coordinates & { label: string }
}

function formatEur(amount: number): string {
  return `€${amount.toFixed(2)}`
}

/**
 * Generates an Uber deep link that pre-fills pickup and dropoff.
 * Works on mobile (opens Uber app if installed) and browser.
 * https://developer.uber.com/docs/riders/ride-requests/tutorials/deep-links/introduction
 */
function buildUberLink(
  pickup: Coordinates & { label: string },
  dropoff: Coordinates,
  dropoffLabel: string
): string {
  const params = new URLSearchParams({
    'action': 'setPickup',
    'pickup[latitude]': pickup.lat.toFixed(6),
    'pickup[longitude]': pickup.lng.toFixed(6),
    'pickup[nickname]': pickup.label,
    'pickup[formatted_address]': pickup.label,
    'dropoff[latitude]': dropoff.lat.toFixed(6),
    'dropoff[longitude]': dropoff.lng.toFixed(6),
    'dropoff[nickname]': dropoffLabel,
    'dropoff[formatted_address]': dropoffLabel,
  })
  return `https://m.uber.com/ul/?${params.toString()}`
}

/**
 * Generates a Bolt deep link that pre-fills pickup and dropoff.
 * Opens the Bolt app on mobile or the Bolt website on desktop.
 */
function buildBoltLink(
  pickup: Coordinates & { label: string },
  dropoff: Coordinates
): string {
  const params = new URLSearchParams({
    'pickup_lat': pickup.lat.toFixed(6),
    'pickup_lng': pickup.lng.toFixed(6),
    'destination_lat': dropoff.lat.toFixed(6),
    'destination_lng': dropoff.lng.toFixed(6),
  })
  return `https://bolt.eu/en/rides/?${params.toString()}`
}

export default function ResultCard({
  alternative,
  isRecommended,
  directFare,
  pickup,
}: ResultCardProps) {
  const { candidate, walkingRoute, fareEstimates, bestFare, savings, score } = alternative
  const savingsPercent = Math.round((savings / directFare.price) * 100)

  const uberLink = buildUberLink(pickup, candidate, candidate.label)
  const boltLink = buildBoltLink(pickup, candidate)

  return (
    <article
      className={`
        relative rounded-2xl border-2 p-5 transition-all duration-300 animate-slide-up
        ${
          isRecommended
            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 shadow-lg shadow-emerald-100 dark:shadow-emerald-900/30'
            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
        }
      `}
      aria-label={`Drop-off alternative: ${candidate.label}`}
    >
      {/* Recommended badge */}
      {isRecommended && (
        <div
          className="absolute -top-3 left-4 bg-emerald-500 text-white text-xs font-bold
                     px-3 py-1 rounded-full shadow-md"
          aria-label="Recommended option"
        >
          ⭐ Best deal
        </div>
      )}

      <div className="space-y-4">
        {/* Location */}
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Drop-off at</p>
          <p className="text-gray-900 dark:text-white font-semibold leading-snug mt-0.5">
            {candidate.label}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            {candidate.direction} · {Math.round(candidate.distanceFromDest)}m from destination
          </p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          {/* Fare */}
          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">Ride fare</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white mt-0.5">
              {formatEur(bestFare.price)}
            </p>
            <span
              className="inline-block mt-1 text-[10px] bg-amber-100 dark:bg-amber-900/40
                         text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded-full font-medium"
              aria-label="Estimated fare"
            >
              Estimated
            </span>
          </div>

          {/* Walk */}
          <div className="text-center border-x border-gray-100 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">Walk</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white mt-0.5">
              {walkingRoute.durationMinutes} min
            </p>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
              🚶 {(walkingRoute.distanceMeters / 1000).toFixed(1)}km
            </p>
          </div>

          {/* Savings */}
          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">You save</p>
            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
              {formatEur(savings)}
            </p>
            <p className="text-[10px] text-emerald-500 dark:text-emerald-500 mt-1">
              💰 {savingsPercent}% off
            </p>
          </div>
        </div>

        {/* Provider breakdown */}
        {fareEstimates.length > 1 && (
          <div className="flex gap-2 flex-wrap">
            {fareEstimates.map((fare) => (
              <div
                key={fare.provider}
                className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-700/50 rounded-lg px-3 py-1.5"
              >
                <ProviderIcon provider={fare.provider} />
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  {formatEur(fare.price)}
                </span>
                {fare.price === bestFare.price && (
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                    best
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Score explanation */}
        <div className="bg-gray-50 dark:bg-gray-700/30 rounded-xl px-3 py-2">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            <span className="font-semibold">Score:</span>{' '}
            <span className="font-mono">{formatEur(bestFare.price)} + ({walkingRoute.durationMinutes} min × €0.40) = {formatEur(score)}</span>
          </p>
          <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
            Score = ride cost + opportunity cost of walking (lower is better)
          </p>
        </div>

        {/* ✅ Deep links — open in Uber / Bolt with drop-off pre-filled */}
        <div className="pt-1">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 font-medium">
            Compare estimated vs real price:
          </p>
          <div className="flex gap-2">
            <a
              href={uberLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 bg-black text-white
                         text-sm font-semibold rounded-xl py-2.5 px-3
                         hover:bg-gray-800 active:scale-95 transition-all duration-150"
              aria-label={`Open Uber with drop-off at ${candidate.label}`}
            >
              <span className="font-black text-base">U</span>
              Open in Uber
            </a>
            <a
              href={boltLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 bg-[#34D186] text-black
                         text-sm font-semibold rounded-xl py-2.5 px-3
                         hover:bg-[#2ABF76] active:scale-95 transition-all duration-150"
              aria-label={`Open Bolt with drop-off at ${candidate.label}`}
            >
              <span className="font-black text-base">⚡</span>
              Open in Bolt
            </a>
          </div>
          <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1.5 text-center">
            See the real fare, then come back and tell us how accurate we were! 🎯
          </p>
        </div>
      </div>
    </article>
  )
}

function ProviderIcon({ provider }: { provider: string }) {
  if (provider.toLowerCase() === 'uber') {
    return (
      <span className="text-sm font-black text-black dark:text-white" aria-label="Uber">
        U
      </span>
    )
  }
  if (provider.toLowerCase() === 'bolt') {
    return (
      <span className="text-sm font-black text-green-600 dark:text-green-400" aria-label="Bolt">
        B
      </span>
    )
  }
  return <span className="text-sm">{provider[0]?.toUpperCase()}</span>
}
