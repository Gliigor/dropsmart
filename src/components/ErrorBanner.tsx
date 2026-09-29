'use client'

/**
 * ErrorBanner component.
 * Shows a dismissable error message with retry button.
 */

interface ErrorBannerProps {
  message: string
  onRetry?: () => void
  onDismiss?: () => void
}

export default function ErrorBanner({ message, onRetry, onDismiss }: ErrorBannerProps) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="rounded-2xl bg-red-50 dark:bg-red-950/30 border-2 border-red-200 dark:border-red-800
                 p-4 flex items-start gap-3 animate-fade-in"
    >
      {/* Icon */}
      <div className="shrink-0 w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center">
        <svg
          className="w-4 h-4 text-red-600 dark:text-red-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-red-800 dark:text-red-300 text-sm">Something went wrong</p>
        <p className="text-red-700 dark:text-red-400 text-sm mt-0.5">{message}</p>

        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-3 text-sm font-semibold text-red-700 dark:text-red-400
                       hover:text-red-900 dark:hover:text-red-200
                       underline underline-offset-2 transition-colors duration-200
                       focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 rounded"
          >
            ↺ Try again
          </button>
        )}
      </div>

      {/* Dismiss */}
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center
                     text-red-400 hover:text-red-600 dark:hover:text-red-200
                     transition-colors duration-200
                     focus:outline-none focus:ring-2 focus:ring-red-500 rounded-full"
          aria-label="Dismiss error"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  )
}
