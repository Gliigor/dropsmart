'use client'

/**
 * Admin dashboard page.
 * Protected by ADMIN_SECRET_KEY query parameter (?key=xxx).
 *
 * Access: /admin?key=YOUR_ADMIN_SECRET_KEY
 */

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import type { AdminStats } from '@/providers/types'
import LoadingSpinner from '@/components/LoadingSpinner'
import { Suspense } from 'react'

function StatCard({
  title,
  value,
  subtitle,
  icon,
  highlight,
}: {
  title: string
  value: string | number
  subtitle?: string
  icon: string
  highlight?: boolean
}) {
  return (
    <div
      className={`
        rounded-2xl p-6 border-2 transition-all duration-200
        ${
          highlight
            ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30'
            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
        }
      `}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
          <p
            className={`text-3xl font-black mt-1 ${
              highlight
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-gray-900 dark:text-white'
            }`}
          >
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{subtitle}</p>
          )}
        </div>
        <span className="text-3xl" aria-hidden="true">
          {icon}
        </span>
      </div>
    </div>
  )
}

function AdminContent() {
  const searchParams = useSearchParams()
  const key = searchParams.get('key')

  const [stats, setStats] = useState<AdminStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/admin/stats?key=${encodeURIComponent(key ?? '')}`)

      if (res.status === 401) {
        setError('Unauthorized. Please provide a valid admin key.')
        return
      }

      if (!res.ok) {
        const data = (await res.json()) as { error: string }
        setError(data.error ?? 'Failed to load stats')
        return
      }

      const data = (await res.json()) as AdminStats
      setStats(data)
    } catch {
      setError('Network error. Could not connect to server.')
    } finally {
      setIsLoading(false)
    }
  }, [key])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" label="Loading admin stats..." />
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto mt-16 text-center">
        <div className="text-5xl mb-4" aria-hidden="true">🔒</div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h2>
        <p className="text-gray-500 dark:text-gray-400 mb-6">{error}</p>
        <p className="text-sm text-gray-400 dark:text-gray-500">
          Access: <code className="bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">/admin?key=YOUR_KEY</code>
        </p>
      </div>
    )
  }

  if (!stats) return null

  const formatEur = (n: number) => `€${n.toFixed(2)}`

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Page title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white">Admin Dashboard</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">DropSmart · Analytics</p>
        </div>
        <button
          onClick={fetchStats}
          className="text-sm text-emerald-600 dark:text-emerald-400 hover:underline font-medium
                     focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded px-2 py-1"
          aria-label="Refresh stats"
        >
          ↺ Refresh
        </button>
      </div>

      {/* Search volume */}
      <section aria-label="Search volume">
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
          Search Volume
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            title="Today"
            value={stats.totalSearchesToday}
            subtitle="searches"
            icon="📅"
          />
          <StatCard
            title="This Week"
            value={stats.totalSearchesWeek}
            subtitle="searches"
            icon="📆"
          />
          <StatCard
            title="All Time"
            value={stats.totalSearchesAllTime}
            subtitle="total searches"
            icon="📊"
          />
        </div>
      </section>

      {/* Savings */}
      <section aria-label="Savings metrics">
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
          Savings Generated
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            title="Average Savings"
            value={formatEur(stats.averageSavings)}
            subtitle="per search"
            icon="💰"
            highlight
          />
          <StatCard
            title="Largest Single Saving"
            value={formatEur(stats.largestSaving)}
            subtitle="ever"
            icon="🏆"
            highlight
          />
          <StatCard
            title="Conversion Rate"
            value="0%"
            subtitle="Pro tier — coming soon"
            icon="📈"
          />
        </div>
      </section>

      {/* Top destinations */}
      <section aria-label="Most searched destinations">
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
          Top Destinations
        </h2>
        <div className="bg-white dark:bg-gray-800 rounded-2xl border-2 border-gray-200 dark:border-gray-700 overflow-hidden">
          {stats.topDestinations.length === 0 ? (
            <div className="p-8 text-center text-gray-400 dark:text-gray-500">
              <p>No destination data yet.</p>
            </div>
          ) : (
            <table className="w-full" aria-label="Top searched destinations">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700">
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Rank
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Destination
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Searches
                  </th>
                </tr>
              </thead>
              <tbody>
                {stats.topDestinations.map((dest, i) => (
                  <tr
                    key={dest.destination}
                    className="border-b border-gray-50 dark:border-gray-700/50 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/20 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <span
                        className={`
                          inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-bold
                          ${
                            i === 0
                              ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400'
                              : i === 1
                              ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                              : i === 2
                              ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400'
                              : 'bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-500'
                          }
                        `}
                      >
                        {i + 1}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-900 dark:text-white font-medium truncate max-w-xs">
                      {dest.destination}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-bold text-gray-900 dark:text-white">
                        {dest.count}
                      </span>
                      <span className="text-gray-400 dark:text-gray-500 text-sm ml-1">
                        searches
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Footer note */}
      <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
        Data from Supabase · Rate limit: 10 searches/IP/day ·{' '}
        <a href="/" className="hover:text-emerald-500 transition-colors">
          Back to app ↗
        </a>
      </p>
    </div>
  )
}

export default function AdminPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Admin header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-3">
          <span className="text-xl" aria-hidden="true">🚶</span>
          <span className="font-black text-gray-900 dark:text-white">DropSmart</span>
          <span className="text-gray-300 dark:text-gray-600">·</span>
          <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-sm">Admin</span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Suspense fallback={<LoadingSpinner size="lg" />}>
          <AdminContent />
        </Suspense>
      </main>
    </div>
  )
}
