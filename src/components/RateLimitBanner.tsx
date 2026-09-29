/**
 * RateLimitBanner component.
 * Shows "X searches remaining today" for the free tier.
 */

interface RateLimitBannerProps {
  remaining: number
  resetAt?: string
}

export default function RateLimitBanner({ remaining, resetAt }: RateLimitBannerProps) {
  const isLow = remaining <= 3
  const isEmpty = remaining === 0

  const resetTime = resetAt
    ? new Date(resetAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'midnight'

  if (isEmpty) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800
                   px-4 py-2.5 flex items-center gap-2 text-sm"
      >
        <span aria-hidden="true">🚫</span>
        <span className="text-amber-800 dark:text-amber-300 font-semibold">
          No searches remaining today.{' '}
          <span className="font-normal text-amber-700 dark:text-amber-400">
            Resets at {resetTime}.
          </span>
        </span>
      </div>
    )
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={`
        rounded-xl border px-4 py-2.5 flex items-center justify-between text-sm
        ${
          isLow
            ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800'
            : 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700'
        }
      `}
    >
      <span
        className={`flex items-center gap-2 ${
          isLow
            ? 'text-amber-800 dark:text-amber-300'
            : 'text-gray-600 dark:text-gray-400'
        }`}
      >
        <span aria-hidden="true">{isLow ? '⚠️' : '🔍'}</span>
        <span>
          <strong className="font-bold">{remaining}</strong> free search
          {remaining !== 1 ? 'es' : ''} remaining today
        </span>
      </span>
      {isLow && (
        <span className="text-xs text-amber-600 dark:text-amber-500">
          Resets at {resetTime}
        </span>
      )}
    </div>
  )
}
