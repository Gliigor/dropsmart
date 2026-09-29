'use client'

/**
 * ResultsPanel component.
 * Leads with the verdict — walk, or just take the ride — then shows the evidence.
 */

import ResultCard from './ResultCard'
import type { SearchResult } from '@/lib/types'

interface ResultsPanelProps {
  results: SearchResult | null
  isLoading: boolean
}

const eur = (n: number) => `${n < 0 ? '−' : ''}€${Math.abs(n).toFixed(2)}`

function SkeletonCard() {
  return (
    <div className="rounded-2xl border-2 border-gray-100 dark:border-gray-700 p-5 animate-pulse space-y-3">
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
      <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
      <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded-xl" />
    </div>
  )
}

export default function ResultsPanel({ results, isLoading }: ResultsPanelProps) {
  if (isLoading) {
    return (
      <section aria-label="Loading results" aria-busy="true" className="space-y-4">
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-48 animate-pulse" />
        <SkeletonCard />
        <SkeletonCard />
      </section>
    )
  }

  if (!results) return null

  const { verdict, best, options, direct, calibration } = results

  return (
    <section aria-label="Search results" className="space-y-5 animate-fade-in">
      {verdict === 'walk' && best ? (
        <div className="bg-emerald-500 rounded-2xl p-4 text-white" role="status">
          <p className="font-bold text-lg">Walking wins: about {eur(best.net)} better</p>
          <p className="text-emerald-100 text-sm mt-0.5">
            Get out at {best.label} and walk {Math.round(best.walkMinutes)} min. That already
            counts the time it costs you.
          </p>
        </div>
      ) : (
        <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl p-4" role="status">
          <p className="font-bold text-lg text-gray-800 dark:text-gray-100">
            Just take the ride to the door
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
            {options.length > 0
              ? 'Every nearby drop-off saves a little on the fare, but not enough to pay for the walk. That is the honest answer for this trip.'
              : 'No nearby drop-off is cheaper than going straight to your destination.'}
          </p>
        </div>
      )}

      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl border-2 border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Direct ride</p>
            <p className="text-gray-900 dark:text-white font-semibold mt-0.5">
              {direct.driveKm} km · {Math.round(direct.driveMinutes)} min
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{eur(direct.fare)}</p>
            <span
              className={`inline-block text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                calibration
                  ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400'
                  : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400'
              }`}
            >
              {calibration ? 'Your quote' : 'Rough estimate'}
            </span>
          </div>
        </div>
        {!calibration && (
          <p className="mt-3 text-xs text-amber-700 dark:text-amber-400">
            This price comes from an unverified model. Enter the price your app shows to get
            numbers you can trust.
          </p>
        )}
      </div>

      {options.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
            {verdict === 'walk' ? 'Options' : 'Closest calls'}
          </h2>
          <div className="space-y-4">
            {options.map((option, i) => (
              <ResultCard key={option.id} option={option} isBest={i === 0} result={results} />
            ))}
          </div>
        </div>
      )}

      {results.warnings.map((w) => (
        <p
          key={w}
          className="text-sm bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 text-amber-800 dark:text-amber-300"
        >
          ⚠️ {w}
        </p>
      ))}

      <p className="text-xs text-gray-400 dark:text-gray-500 text-center pb-2">
        Times come from road routing without live traffic. Fares change minute to minute, so
        always confirm in the app.
      </p>
    </section>
  )
}
