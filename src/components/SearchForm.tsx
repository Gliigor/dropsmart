'use client'

/**
 * SearchForm component.
 * Pickup + destination text inputs, walking time selector, submit button.
 */

import { useState, type FormEvent } from 'react'
import type { SearchRequest } from '@/providers/types'

interface SearchFormProps {
  onSearch: (request: SearchRequest) => void
  isLoading: boolean
}

const WALKING_OPTIONS: { value: SearchRequest['maxWalkingMinutes']; label: string }[] = [
  { value: 3, label: '3 min (~250m)' },
  { value: 5, label: '5 min (~400m)' },
  { value: 10, label: '10 min (~800m)' },
  { value: 15, label: '15 min (~1.2km)' },
]

const PROVIDER_OPTIONS: { value: SearchRequest['provider']; label: string }[] = [
  { value: 'both', label: 'Uber & Bolt' },
  { value: 'uber', label: 'Uber only' },
  { value: 'bolt', label: 'Bolt only' },
]

export default function SearchForm({ onSearch, isLoading }: SearchFormProps) {
  const [pickup, setPickup] = useState('')
  const [destination, setDestination] = useState('')
  const [maxWalkingMinutes, setMaxWalkingMinutes] = useState<SearchRequest['maxWalkingMinutes']>(5)
  const [provider, setProvider] = useState<SearchRequest['provider']>('both')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!pickup.trim() || !destination.trim()) return
    onSearch({ pickup: pickup.trim(), destination: destination.trim(), maxWalkingMinutes, provider })
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 space-y-5"
      aria-label="Search for cheaper drop-off points"
    >
      <div className="space-y-4">
        {/* Pickup */}
        <div>
          <label
            htmlFor="pickup"
            className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5"
          >
            📍 Pickup location
          </label>
          <input
            id="pickup"
            type="text"
            value={pickup}
            onChange={(e) => setPickup(e.target.value)}
            placeholder="e.g. Amsterdam Centraal"
            required
            disabled={isLoading}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600
                       bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white
                       placeholder-gray-400 dark:placeholder-gray-500
                       focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent
                       disabled:opacity-50 disabled:cursor-not-allowed
                       transition-all duration-200"
            aria-label="Pickup location"
          />
        </div>

        {/* Destination */}
        <div>
          <label
            htmlFor="destination"
            className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5"
          >
            🏁 Destination
          </label>
          <input
            id="destination"
            type="text"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="e.g. Vondelpark, Amsterdam"
            required
            disabled={isLoading}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600
                       bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white
                       placeholder-gray-400 dark:placeholder-gray-500
                       focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent
                       disabled:opacity-50 disabled:cursor-not-allowed
                       transition-all duration-200"
            aria-label="Destination"
          />
        </div>

        {/* Walking time */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            🚶 Max walking time
          </label>
          <div className="grid grid-cols-4 gap-2" role="group" aria-label="Maximum walking time">
            {WALKING_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setMaxWalkingMinutes(opt.value)}
                disabled={isLoading}
                aria-pressed={maxWalkingMinutes === opt.value}
                className={`
                  py-2.5 px-2 rounded-xl text-sm font-semibold transition-all duration-200
                  focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1
                  disabled:opacity-50 disabled:cursor-not-allowed
                  ${
                    maxWalkingMinutes === opt.value
                      ? 'bg-emerald-500 text-white shadow-md shadow-emerald-200 dark:shadow-emerald-900'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-emerald-50 dark:hover:bg-gray-600'
                  }
                `}
              >
                {opt.label.split(' ')[0]}&nbsp;min
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
            {WALKING_OPTIONS.find((o) => o.value === maxWalkingMinutes)?.label}
          </p>
        </div>

        {/* Provider */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            🚗 Provider
          </label>
          <div className="flex gap-2">
            {PROVIDER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setProvider(opt.value)}
                disabled={isLoading}
                aria-pressed={provider === opt.value}
                className={`
                  flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-all duration-200
                  focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1
                  disabled:opacity-50 disabled:cursor-not-allowed
                  ${
                    provider === opt.value
                      ? 'bg-emerald-500 text-white shadow-md'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-emerald-50 dark:hover:bg-gray-600'
                  }
                `}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={isLoading || !pickup.trim() || !destination.trim()}
        className="w-full py-4 px-6 rounded-xl bg-emerald-500 hover:bg-emerald-600
                   text-white font-bold text-base
                   shadow-lg shadow-emerald-200 dark:shadow-emerald-900
                   focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2
                   disabled:opacity-50 disabled:cursor-not-allowed
                   transition-all duration-200 active:scale-[0.98]"
        aria-label="Find cheapest drop-off point"
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <svg
              className="animate-spin h-5 w-5 text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Searching...
          </span>
        ) : (
          '💰 Find cheapest drop-off'
        )}
      </button>
    </form>
  )
}
