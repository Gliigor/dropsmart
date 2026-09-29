'use client'

/**
 * Main page — DropSmart.
 * Search form + results panel + map side by side (desktop) or stacked (mobile).
 */

import { useState, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import SearchForm from '@/components/SearchForm'
import ResultsPanel from '@/components/ResultsPanel'
import ErrorBanner from '@/components/ErrorBanner'
import RateLimitBanner from '@/components/RateLimitBanner'
import type { SearchRequest, SearchResult } from '@/providers/types'

// Dynamic import: Leaflet requires window (no SSR)
const MapView = dynamic(() => import('@/components/MapView'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full rounded-2xl bg-gray-200 dark:bg-gray-700 animate-pulse flex items-center justify-center">
      <p className="text-gray-400 dark:text-gray-500 text-sm">Loading map...</p>
    </div>
  ),
})

export default function HomePage() {
  const [isLoading, setIsLoading] = useState(false)
  const [results, setResults] = useState<SearchResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [rateLimitRemaining, setRateLimitRemaining] = useState<number | null>(null)
  const [rateLimitResetAt, setRateLimitResetAt] = useState<string | undefined>(undefined)
  const lastRequest = useRef<SearchRequest | null>(null)

  const handleSearch = useCallback(async (request: SearchRequest) => {
    lastRequest.current = request
    setIsLoading(true)
    setError(null)
    setResults(null)

    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      })

      // Update rate limit from headers
      const remaining = res.headers.get('X-RateLimit-Remaining')
      const resetAt = res.headers.get('X-RateLimit-Reset')
      if (remaining !== null) setRateLimitRemaining(parseInt(remaining, 10))
      if (resetAt) setRateLimitResetAt(resetAt)

      const data = (await res.json()) as SearchResult | { error: string; remaining?: number }

      if (!res.ok) {
        const errData = data as { error: string; remaining?: number }
        if (res.status === 429) {
          setRateLimitRemaining(0)
          setError(errData.error ?? 'Rate limit exceeded')
        } else {
          setError(errData.error ?? `Request failed: ${res.status}`)
        }
        return
      }

      setResults(data as SearchResult)
      setRateLimitRemaining((data as SearchResult).rateLimitRemaining)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Network error. Please check your connection and try again.'
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  const handleRetry = useCallback(() => {
    if (lastRequest.current) {
      handleSearch(lastRequest.current)
    }
  }, [handleSearch])

  const showMap = results !== null && !isLoading

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2 group" aria-label="DropSmart home">
            <span className="text-2xl" aria-hidden="true">🚶</span>
            <div>
              <span className="font-black text-gray-900 dark:text-white text-lg leading-none">
                Walk
              </span>
              <span className="font-black text-emerald-500 text-lg leading-none ml-1">
                For Savings
              </span>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 leading-none mt-0.5">
                by gligor.xyz
              </p>
            </div>
          </a>

          <div className="flex items-center gap-3">
            <a
              href="https://gligor.xyz"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-emerald-500 transition-colors duration-200 hidden sm:block"
            >
              gligor.xyz ↗
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-br from-emerald-500 to-emerald-700 text-white py-10 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-3xl sm:text-4xl font-black leading-tight">
            Save money on every ride
          </h1>
          <p className="mt-3 text-emerald-100 text-lg">
            Get dropped off nearby and walk the last few minutes. Save €2–10+ per ride.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3 text-sm">
            <span className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full">
              ✓ Free to use
            </span>
            <span className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full">
              ✓ Uber & Bolt estimates
            </span>
            <span className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full">
              ✓ Real walking routes
            </span>
          </div>
        </div>
      </section>

      {/* Main content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Rate limit banner */}
        {rateLimitRemaining !== null && rateLimitRemaining <= 5 && (
          <div className="mb-6">
            <RateLimitBanner
              remaining={rateLimitRemaining}
              resetAt={rateLimitResetAt}
            />
          </div>
        )}

        <div className={`grid gap-8 ${showMap ? 'lg:grid-cols-2' : 'max-w-2xl mx-auto'}`}>
          {/* Left panel: form + results */}
          <div className="space-y-6">
            <SearchForm onSearch={handleSearch} isLoading={isLoading} />

            {error && (
              <ErrorBanner
                message={error}
                onRetry={lastRequest.current ? handleRetry : undefined}
                onDismiss={() => setError(null)}
              />
            )}

            <ResultsPanel results={results} isLoading={isLoading} />
          </div>

          {/* Right panel: map (desktop) or below (mobile) */}
          {showMap && (
            <div className="lg:sticky lg:top-24 lg:self-start">
              <div className="h-[500px] lg:h-[calc(100vh-10rem)]">
                <MapView results={results} />
              </div>
            </div>
          )}
        </div>

        {/* How it works */}
        {!results && !isLoading && (
          <section className="mt-16 max-w-4xl mx-auto" aria-label="How DropSmart works">
            <h2 className="text-2xl font-bold text-center text-gray-800 dark:text-gray-200 mb-8">
              How it works
            </h2>
            <div className="grid sm:grid-cols-3 gap-6">
              {[
                {
                  icon: '📍',
                  title: '1. Enter your route',
                  desc: 'Type your pickup and destination. Works for any location in Amsterdam.',
                },
                {
                  icon: '🔍',
                  title: '2. We find alternatives',
                  desc: 'Our algorithm generates candidate drop-off points near your destination and calculates real walking routes.',
                },
                {
                  icon: '💰',
                  title: '3. Save on your ride',
                  desc: 'Choose from alternatives sorted by total cost (fare + walking time value). Save up to 30%.',
                },
              ].map((step) => (
                <div
                  key={step.title}
                  className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 text-center"
                >
                  <div className="text-4xl mb-3" aria-hidden="true">{step.icon}</div>
                  <h3 className="font-bold text-gray-900 dark:text-white mb-2">{step.title}</h3>
                  <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>

            {/* Disclaimer */}
            <div className="mt-8 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 text-sm text-amber-800 dark:text-amber-300">
              <p className="font-semibold mb-1">⚠️ About fare estimates</p>
              <p>
                Uber and Bolt do not provide public APIs. All fares are estimated using known Amsterdam
                pricing formulas and are clearly labeled as &quot;Estimated&quot;. Actual fares may differ
                due to surge pricing, traffic, and routing. Always verify the fare in your ride-hailing app
                before booking.
              </p>
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 py-6 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-gray-500 dark:text-gray-400">
          <p>
            Built by{' '}
            <a
              href="https://gligor.xyz"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-600 dark:text-emerald-400 hover:underline font-medium"
            >
              Gligorilla
            </a>{' '}
            · Financial tools for the modern commuter
          </p>
          <p>
            Using{' '}
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-emerald-500 transition-colors"
            >
              OpenStreetMap
            </a>{' '}
            ·{' '}
            <a
              href="https://nominatim.openstreetmap.org"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-emerald-500 transition-colors"
            >
              Nominatim
            </a>{' '}
            ·{' '}
            <a
              href="https://openrouteservice.org"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-emerald-500 transition-colors"
            >
              ORS
            </a>
          </p>
        </div>
      </footer>
    </div>
  )
}
