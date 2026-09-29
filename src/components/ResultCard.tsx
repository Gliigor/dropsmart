'use client'

/**
 * ResultCard component.
 * One alternative drop-off, judged against the direct ride, with a way to check the
 * real price in the app and see the true net saving.
 */

import { useState } from 'react'
import type { Option, Place, SearchResult } from '@/lib/types'

interface ResultCardProps {
  option: Option
  isBest: boolean
  result: SearchResult
}

const eur = (n: number) => `${n < 0 ? '−' : ''}€${Math.abs(n).toFixed(2)}`

/** Uber's documented deep link; pre-fills pickup and drop-off. */
function buildUberLink(pickup: Place, option: Option): string {
  const params = new URLSearchParams({
    action: 'setPickup',
    'pickup[latitude]': pickup.lat.toFixed(6),
    'pickup[longitude]': pickup.lng.toFixed(6),
    'pickup[nickname]': pickup.label,
    'dropoff[latitude]': option.lat.toFixed(6),
    'dropoff[longitude]': option.lng.toFixed(6),
    'dropoff[nickname]': option.label,
  })
  return `https://m.uber.com/ul/?${params.toString()}`
}

function parseEuro(value: string): number | null {
  const n = parseFloat(value.replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : null
}

export default function ResultCard({ option, isBest, result }: ResultCardProps) {
  const [realFare, setRealFare] = useState('')
  const [realDirect, setRealDirect] = useState('')

  const directIsModel = result.direct.fareSource === 'model'
  const realFareN = parseEuro(realFare)
  const realDirectN = directIsModel ? parseEuro(realDirect) : result.direct.fare
  const realNet =
    realFareN !== null && realDirectN !== null ? realDirectN - realFareN - option.timeCost : null

  const wins = option.net >= 1
  const border = isBest && wins
    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30'
    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'

  return (
    <article className={`relative rounded-2xl border-2 p-5 ${border}`} aria-label={`Drop-off at ${option.label}`}>
      {isBest && wins && (
        <div className="absolute -top-3 left-4 bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md">
          ⭐ Best option
        </div>
      )}

      <div className="space-y-4">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Get out at</p>
          <p className="text-gray-900 dark:text-white font-semibold leading-snug mt-0.5">{option.label}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            {option.direction} of your destination · {option.distanceFromDestM} m away
          </p>
        </div>

        <dl className="grid grid-cols-3 gap-3 text-center">
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">Ride costs</dt>
            <dd className="text-xl font-bold text-gray-900 dark:text-white mt-0.5">{eur(option.fare)}</dd>
            <dd className="text-[10px] text-gray-400 mt-1">saves {eur(option.savings)}</dd>
          </div>
          <div className="border-x border-gray-100 dark:border-gray-700">
            <dt className="text-xs text-gray-500 dark:text-gray-400">You walk</dt>
            <dd className="text-xl font-bold text-gray-900 dark:text-white mt-0.5">
              {Math.round(option.walkMinutes)} min
            </dd>
            <dd className="text-[10px] text-gray-400 mt-1">{(option.walkMeters / 1000).toFixed(1)} km</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">Real gain</dt>
            <dd
              className={`text-xl font-bold mt-0.5 ${
                wins ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
              }`}
            >
              {eur(option.net)}
            </dd>
            <dd className="text-[10px] text-gray-400 mt-1">after your time</dd>
          </div>
        </dl>

        <p className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/30 rounded-xl px-3 py-2">
          Saves {eur(option.savings)} on the fare, but the trip takes{' '}
          {option.extraMinutes >= 0
            ? `${option.extraMinutes.toFixed(0)} min longer`
            : `${Math.abs(option.extraMinutes).toFixed(0)} min less`}{' '}
          overall, which is worth {eur(option.timeCost)} at your rate. Net {eur(option.net)}.
        </p>

        <div className="space-y-2 pt-1">
          <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">
            Check the real price before you commit
          </p>
          <a
            href={buildUberLink(result.pickup, option)}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center bg-black text-white text-sm font-semibold rounded-xl py-2.5 hover:bg-gray-800 transition-colors"
          >
            Open in Uber with this drop-off
          </a>
          <p className="text-[11px] text-gray-400">
            Using Bolt? Type <span className="font-mono">{option.label}</span> as the drop-off.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              inputMode="decimal"
              value={realFare}
              onChange={(e) => setRealFare(e.target.value)}
              placeholder="Price for this drop-off €"
              aria-label="Real price the app shows for this drop-off"
              className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
            />
            {directIsModel && (
              <input
                type="text"
                inputMode="decimal"
                value={realDirect}
                onChange={(e) => setRealDirect(e.target.value)}
                placeholder="Price for direct ride €"
                aria-label="Real price the app shows for the direct ride"
                className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
              />
            )}
          </div>
          {realNet !== null && (
            <p
              className={`text-sm font-semibold ${
                realNet >= 1 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
              }`}
              role="status"
            >
              With real prices: {realNet >= 1 ? `walking wins by ${eur(realNet)}` : `not worth it (${eur(realNet)})`}
            </p>
          )}
        </div>
      </div>
    </article>
  )
}
