'use client'

/**
 * ResultsPanel component.
 * Shows the direct ride, all alternatives, the recommended option,
 * and a cumulative "total saved by DropSmart users" counter.
 * Includes skeleton loading states.
 */

import { useEffect, useState } from 'react'
import ResultCard from './ResultCard'
import type { SearchResult } from '@/providers/types'

interface ResultsPanelProps {
  results: SearchResult | null
  isLoading: boolean
}

/**
 * Animates a number counting up from 0 to target over ~1.2s.
 * Used for the cumulative savings counter.
 */
function useCountUp(target: number, duration = 1200): number {
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (target === 0) return
    const startTime = performance.now()
    const tick = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.floor(eased * target))
      if (progress < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [target, duration])

  return value
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl border-2 border-gray-100 dark:border-gray-700 p-5 animate-pulse">
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-20" />
          <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-32" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-2 text-center">
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-12 mx-auto" />
              <div className="h-7 bg-gray-200 dark:bg-gray-700 rounded w-16 mx-auto" />
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-10 mx-auto" />
            </div>
          ))}
        </div>
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-xl" />
        <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded-xl" />
      </div>
    </div>
  )
}

function DirectRideCard({ results }: { results: SearchResult }) {
  const { bestDirectFare } = results
  return (
    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl border-2 border-gray-200 dark:border-gray-700 p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Direct ride</p>
          <p className="text-gray-900 dark:text-white font-semibold mt-0.5">
            No walking required
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            €{bestDirectFare.price.toFixed(2)}
          </p>
          <span
            className="inline-block text-[10px] bg-amber-100 dark:bg-amber-900/40
                       text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded-full font-medium"
          >
            Estimated
          </span>
        </div>
      </div>
      {results.directFares.length > 1 && (
        <div className="mt-3 flex gap-3 text-sm text-gray-500 dark:text-gray-400">
          {results.directFares.map((f) => (
            <span key={f.provider}>
              {f.provider}: €{f.price.toFixed(2)}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * CumulativeSavingsBanner
 * Shows total money saved by all DropSmart users.
 * Fetches from /api/admin/stats (public aggregate endpoint — no key needed for total savings).
 * Falls back gracefully if Supabase is not configured.
 */
function CumulativeSavingsBanner() {
  const [totalSaved, setTotalSaved] = useState<number | null>(null)
  const [totalSearches, setTotalSearches] = useState<number | null>(null)
  const animatedSavings = useCountUp(totalSaved ?? 0)
  const animatedSearches = useCountUp(totalSearches ?? 0)

  useEffect(() => {
    fetch('/api/stats/public')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) {
          setTotalSaved(data.totalSaved ?? 0)
          setTotalSearches(data.totalSearches ?? 0)
        }
      })
      .catch(() => {
        // Supabase not configured or network error — silently skip
      })
  }, [])

  if (totalSaved === null) return null

  return (
    <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 rounded-2xl p-4 text-white shadow-lg shadow-emerald-100 dark:shadow-emerald-900/30">
      <p className="text-xs font-semibold uppercase tracking-wider text-emerald-100 mb-1">
        💸 DropSmart community total
      </p>
      <div className="flex items-end gap-6">
        <div>
          <p className="text-3xl font-black">
            €{animatedSavings.toLocaleString()}
          </p>
          <p className="text-emerald-100 text-sm">saved by our users</p>
        </div>
        <div className="border-l border-emerald-400 pl-6">
          <p className="text-2xl font-black">
            {animatedSearches.toLocaleString()}
          </p>
          <p className="text-emerald-100 text-sm">rides optimised</p>
        </div>
      </div>
    </div>
  )
}

export default function ResultsPanel({ results, isLoading }: ResultsPanelProps) {
  if (isLoading) {
    return (
      <section aria-label="Loading results" aria-busy="true">
        <div className="space-y-4">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-48 animate-pulse" />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </section>
    )
  }

  if (!results) {
    // Show community stats even before first search
    return (
      <div className="space-y-4">
        <CumulativeSavingsBanner />
      </div>
    )
  }

  const { alternatives, maxSavings } = results

  return (
    <section aria-label="Search results" className="space-y-5 animate-fade-in">
      {/* Summary banner */}
      {alternatives.length > 0 ? (
        <div className="bg-emerald-500 rounded-2xl p-4 text-white">
          <p className="font-bold text-lg">
            💰 Save up to €{maxSavings.toFixed(2)} on this ride!
          </p>
          <p className="text-emerald-100 text-sm mt-0.5">
            {alternatives.length} cheaper drop-off{alternatives.length !== 1 ? 's' : ''} found
            within {results.walkingMinutes} min walk
          </p>
        </div>
      ) : (
        <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl p-4 text-center">
          <p className="font-semibold text-gray-700 dark:text-gray-300">
            No significant savings found
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Try increasing the walking time, or this route may already be well-priced.
          </p>
        </div>
      )}

      {/* Direct ride */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
          Baseline
        </h2>
        <DirectRideCard results={results} />
      </div>

      {/* Alternatives */}
      {alternatives.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
            Alternatives ({alternatives.length})
          </h2>
          <div className="space-y-4">
            {alternatives.map((alt, i) => (
              <ResultCard
                key={`${alt.candidate.lat}-${alt.candidate.lng}`}
                alternative={alt}
                isRecommended={i === 0}
                directFare={results.bestDirectFare}
                pickup={results.pickup}
              />
            ))}
          </div>
        </div>
      )}

      {/* Community savings counter */}
      <CumulativeSavingsBanner />

      {/* Disclaimer */}
      <p className="text-xs text-gray-400 dark:text-gray-500 text-center pb-2">
        ⚠️ All fares are estimates based on Amsterdam pricing. Actual fares may vary due to
        surge pricing, traffic, and route differences.
      </p>
    </section>
  )
}
