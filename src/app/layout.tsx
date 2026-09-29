import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'DropSmart | Is walking the last bit worth it?',
  description:
    'Find out whether getting dropped off a few minutes early actually saves money on Uber and Bolt, after counting your time. Honest verdict, real road routing.',
  keywords: ['uber savings', 'bolt savings', 'cheap ride', 'walk drop-off', 'Amsterdam'],
  authors: [{ name: 'Gligorilla', url: 'https://gligor.xyz' }],
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://gligor.xyz'),
  openGraph: {
    title: 'DropSmart | Is walking the last bit worth it?',
    description: 'Compare the fare saved against the time you spend. Free tool.',
    type: 'website',
    url: '/',
    siteName: 'DropSmart',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DropSmart | Is walking the last bit worth it?',
    description: 'Compare the fare saved against the time you spend. Free tool.',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Preconnect to map tile servers */}
        <link rel="preconnect" href="https://tile.openstreetmap.org" />
        <link rel="preconnect" href="https://nominatim.openstreetmap.org" />
        <meta name="theme-color" content="#10b981" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🚶</text></svg>" />
      </head>
      <body className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-200">
        {children}
      </body>
    </html>
  )
}
