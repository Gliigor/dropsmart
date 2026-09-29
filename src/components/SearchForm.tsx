'use client'

/**
 * SearchForm component.
 * Route, walking limit, provider, and the two inputs that make the answer honest:
 * the real fare from the app and how much the user values their time.
 */

import { useState, type FormEvent } from 'react'
import type { ProviderId, SearchRequest, WalkMinutes } from '@/lib/types'

interface SearchFormProps {
  onSearch: (request: SearchRequest) => void
  isLoading: boolean
}

const WALKING_OPTIONS: WalkMinutes[] = [3, 5, 10, 15]

const PROVIDER_OPTIONS: { value: ProviderId; label: string }[] = [
  { value: 'bolt', label: 'Bolt' },
  { value: 'uber', label: 'Uber' },
]

const INPUT_CLASS = `w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600
  bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white
  placeholder-gray-400 dark:placeholder-gray-500
  focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent
  disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200`

const LABEL_CLASS = 'block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5'

function toggleClass(active: boolean): string {
  return `flex-1 py-2.5 px-3 rounded-xl text-sm font-semibold transition-all duration-200
    focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1
    disabled:opacity-50 disabled:cursor-not-allowed ${
      active
        ? 'bg-emerald-500 text-white shadow-md'
        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-emerald-50 dark:hover:bg-gray-600'
    }`
}

export default function SearchForm({ onSearch, isLoading }: SearchFormProps) {
  const [pickup, setPickup] = useState('')
  const [destination, setDestination] = useState('')
  const [maxWalkingMinutes, setMaxWalkingMinutes] = useState<WalkMinutes>(10)
  const [provider, setProvider] = useState<ProviderId>('bolt')
  const [quote, setQuote] = useState('')
  const [hourly, setHourly] = useState('15')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!pickup.trim() || !destination.trim()) return
    const quoteNumber = parseFloat(quote.replace(',', '.'))
    const hourlyNumber = parseFloat(hourly.replace(',', '.'))
    onSearch({
      pickup: pickup.trim(),
      destination: destination.trim(),
      maxWalkingMinutes,
      provider,
      directQuote: Number.isFinite(quoteNumber) && quoteNumber > 0 ? quoteNumber : undefined,
      valueOfTimePerHour: Number.isFinite(hourlyNumber) && hourlyNumber >= 0 ? hourlyNumber : undefined,
    })
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 space-y-5"
      aria-label="Check whether walking the last stretch saves money"
    >
      <div className="space-y-4">
        <div>
          <label htmlFor="pickup" className={LABEL_CLASS}>📍 Pickup location</label>
          <input
            id="pickup"
            type="text"
            value={pickup}
            onChange={(e) => setPickup(e.target.value)}
            placeholder="e.g. Amsterdam Centraal"
            required
            maxLength={200}
            disabled={isLoading}
            className={INPUT_CLASS}
          />
        </div>

        <div>
          <label htmlFor="destination" className={LABEL_CLASS}>🏁 Destination</label>
          <input
            id="destination"
            type="text"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="e.g. Vondelpark, Amsterdam"
            required
            maxLength={200}
            disabled={isLoading}
            className={INPUT_CLASS}
          />
        </div>

        <div>
          <label className={LABEL_CLASS}>🚗 App</label>
          <div className="flex gap-2" role="group" aria-label="Ride app">
            {PROVIDER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setProvider(opt.value)}
                disabled={isLoading}
                aria-pressed={provider === opt.value}
                className={toggleClass(provider === opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="quote" className={LABEL_CLASS}>
            💶 Price the app shows for the direct ride{' '}
            <span className="font-normal text-gray-400">(recommended)</span>
          </label>
          <input
            id="quote"
            type="text"
            inputMode="decimal"
            value={quote}
            onChange={(e) => setQuote(e.target.value)}
            placeholder="e.g. 14.50"
            disabled={isLoading}
            className={INPUT_CLASS}
          />
          <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
            Without it we only have a rough price model. With it, every estimate is scaled to what
            the app really charges right now, surge included.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={LABEL_CLASS}>🚶 Max walk</label>
            <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="Maximum walking time">
              {WALKING_OPTIONS.map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  onClick={() => setMaxWalkingMinutes(minutes)}
                  disabled={isLoading}
                  aria-pressed={maxWalkingMinutes === minutes}
                  className={toggleClass(maxWalkingMinutes === minutes)}
                >
                  {minutes}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">minutes</p>
          </div>
          <div>
            <label htmlFor="hourly" className={LABEL_CLASS}>⏱ Your time is worth</label>
            <div className="relative">
              <input
                id="hourly"
                type="text"
                inputMode="decimal"
                value={hourly}
                onChange={(e) => setHourly(e.target.value)}
                disabled={isLoading}
                className={`${INPUT_CLASS} pr-14`}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">€/hr</span>
            </div>
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={isLoading || !pickup.trim() || !destination.trim()}
        className="w-full py-4 px-6 rounded-xl bg-emerald-500 hover:bg-emerald-600
                   text-white font-bold text-base shadow-lg shadow-emerald-200 dark:shadow-emerald-900
                   focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2
                   disabled:opacity-50 disabled:cursor-not-allowed
                   transition-all duration-200 active:scale-[0.98]"
      >
        {isLoading ? 'Checking routes…' : 'Is walking worth it?'}
      </button>
    </form>
  )
}
