/**
 * Admin stats API route.
 *
 * GET /api/admin/stats?key=ADMIN_SECRET_KEY
 *
 * Returns analytics data from the Supabase searches table.
 * Protected by ADMIN_SECRET_KEY environment variable.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAdminStats } from '@/lib/supabase'
import type { AdminStats, ApiError } from '@/providers/types'

export const runtime = 'nodejs'

export async function GET(
  req: NextRequest
): Promise<NextResponse<AdminStats | ApiError>> {
  // Auth check
  const key = req.nextUrl.searchParams.get('key')
  const adminKey = process.env.ADMIN_SECRET_KEY

  if (!adminKey || key !== adminKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const stats = await getAdminStats()

    if (!stats) {
      // Supabase not configured — return zeros
      return NextResponse.json({
        totalSearchesToday: 0,
        totalSearchesWeek: 0,
        totalSearchesAllTime: 0,
        averageSavings: 0,
        largestSaving: 0,
        topDestinations: [],
      })
    }

    return NextResponse.json(stats)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    console.error('[Admin Stats API] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
