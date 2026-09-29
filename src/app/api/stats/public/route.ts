/**
 * Public stats API — no auth required.
 * Returns only aggregate community totals for the savings banner.
 * GET /api/stats/public
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    // Supabase not configured — return zeros gracefully
    return NextResponse.json({ totalSaved: 0, totalSearches: 0 })
  }

  try {
    const client = createClient(url, key)

    const [savingsResult, countResult] = await Promise.all([
      // Sum of all savings
      client.from('searches').select('savings').not('savings', 'is', null),
      // Total search count
      client.from('searches').select('id', { count: 'exact', head: true }),
    ])

    const totalSaved =
      (savingsResult.data ?? [])
        .map((r: { savings: number | null }) => r.savings ?? 0)
        .reduce((a: number, b: number) => a + b, 0)

    const totalSearches = countResult.count ?? 0

    return NextResponse.json({
      totalSaved: Math.round(totalSaved * 100) / 100,
      totalSearches,
    })
  } catch {
    return NextResponse.json({ totalSaved: 0, totalSearches: 0 })
  }
}
