/**
 * Supabase client and type-safe query helpers.
 *
 * Database schema (run this SQL in your Supabase project):
 *
 * -- searches table
 * create table searches (
 *   id uuid default gen_random_uuid() primary key,
 *   created_at timestamptz default now(),
 *   pickup text not null,
 *   destination text not null,
 *   pickup_lat double precision,
 *   pickup_lng double precision,
 *   dest_lat double precision,
 *   dest_lng double precision,
 *   direct_price numeric(10,2),
 *   best_price numeric(10,2),
 *   savings numeric(10,2),
 *   walking_minutes integer,
 *   provider text,
 *   ip_hash text
 * );
 *
 * -- index for analytics
 * create index searches_created_at_idx on searches(created_at);
 * create index searches_destination_idx on searches(destination);
 */

import { createClient } from '@supabase/supabase-js'

/** Row shape matching the Supabase searches table */
export interface SearchRow {
  id?: string
  created_at?: string
  pickup: string
  destination: string
  pickup_lat?: number
  pickup_lng?: number
  dest_lat?: number
  dest_lng?: number
  direct_price?: number
  best_price?: number
  savings?: number
  walking_minutes?: number
  provider?: string
  ip_hash?: string
}

/** Create a Supabase client using the public anon key (safe for browser) */
function createBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    return null
  }

  return createClient(url, key)
}

/** Create a Supabase client using the service role key (server-only, elevated permissions) */
function createServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    return null
  }

  return createClient(url, key)
}

/** Singleton browser client */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let browserClient: ReturnType<typeof createClient<any>> | null = null

export function getSupabaseBrowserClient() {
  if (!browserClient) {
    browserClient = createBrowserClient()
  }
  return browserClient
}

/** Always create a fresh server client (avoid shared state in serverless) */
export function getSupabaseServerClient() {
  return createServerClient()
}

/**
 * Save a search record to Supabase.
 * Fire-and-forget: errors are logged but don't fail the request.
 */
export async function saveSearch(data: SearchRow): Promise<void> {
  const client = getSupabaseServerClient()
  if (!client) return // Supabase not configured

  try {
    const { error } = await client.from('searches').insert(data)
    if (error) {
      console.error('[Supabase] Failed to save search:', error.message)
    }
  } catch (err) {
    console.error('[Supabase] Unexpected error saving search:', err)
  }
}

/**
 * Get admin analytics stats from the searches table.
 */
export async function getAdminStats() {
  const client = getSupabaseServerClient()
  if (!client) {
    return null
  }

  const now = new Date()
  const todayStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  ).toISOString()
  const weekStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 7)
  ).toISOString()

  const [
    todayResult,
    weekResult,
    allTimeResult,
    avgSavingsResult,
    maxSavingsResult,
    topDestResult,
  ] = await Promise.all([
    // Today count
    client
      .from('searches')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', todayStart),

    // Week count
    client
      .from('searches')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', weekStart),

    // All time count
    client.from('searches').select('id', { count: 'exact', head: true }),

    // Average savings
    client.from('searches').select('savings').not('savings', 'is', null),

    // Max savings
    client
      .from('searches')
      .select('savings')
      .not('savings', 'is', null)
      .order('savings', { ascending: false })
      .limit(1),

    // Top destinations
    client
      .from('searches')
      .select('destination')
      .not('destination', 'is', null)
      .limit(200),
  ])

  // Calculate average savings manually since Supabase doesn't support AVG directly
  const savingsValues = (avgSavingsResult.data ?? [])
    .map((r: { savings: number | null }) => r.savings)
    .filter((v): v is number => v !== null)

  const avgSavings =
    savingsValues.length > 0
      ? savingsValues.reduce((a, b) => a + b, 0) / savingsValues.length
      : 0

  // Calculate top destinations
  const destCounts: Record<string, number> = {}
  for (const row of topDestResult.data ?? []) {
    const dest = (row as { destination: string }).destination
    if (dest) destCounts[dest] = (destCounts[dest] ?? 0) + 1
  }
  const topDestinations = Object.entries(destCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([destination, count]) => ({ destination, count }))

  return {
    totalSearchesToday: todayResult.count ?? 0,
    totalSearchesWeek: weekResult.count ?? 0,
    totalSearchesAllTime: allTimeResult.count ?? 0,
    averageSavings: Math.round(avgSavings * 100) / 100,
    largestSaving:
      (maxSavingsResult.data?.[0] as { savings: number } | undefined)?.savings ?? 0,
    topDestinations,
  }
}
