import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { distanceMeters } from '@/lib/geo'
import { decodePolyline } from '@/lib/routing'
import { runSearch, SearchError } from '@/lib/search'
import type { Coordinates, SearchRequest } from '@/lib/types'

const PLACES: Record<string, Coordinates> = {
  centraal: { lat: 52.3791, lng: 4.9003 },
  vondelpark: { lat: 52.3579, lng: 4.8686 },
}

interface Stub {
  /** [minutes, km, snapMeters] for point i (0 = the destination), or null if unroutable */
  drive: (i: number, pickup: Coordinates, point: Coordinates) => [number, number, number] | null
  osrmFails?: boolean
  osrmCalls: string[]
}

/** Realistic OSRM: straight line x1.3 at 25 km/h. */
const roadLike: Stub['drive'] = (_i, pickup, point) => {
  const km = (distanceMeters(pickup, point) / 1000) * 1.3
  return [(km / 25) * 60, km, 0]
}

function installFetchStub(stub: Stub) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL) => {
      const url = String(input)
      const json = (body: unknown, status = 200) =>
        new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

      if (url.includes('nominatim') && url.includes('/search')) {
        const q = new URL(url).searchParams.get('q')!.toLowerCase()
        const p = PLACES[q]
        return p
          ? json([{ lat: String(p.lat), lon: String(p.lng), display_name: q }])
          : json([])
      }
      if (url.includes('nominatim') && url.includes('/reverse')) {
        return json({ display_name: 'Teststraat 1', address: { road: 'Teststraat', house_number: '1' } })
      }
      if (url.includes('/table/v1/driving/')) {
        stub.osrmCalls.push(url)
        if (stub.osrmFails) return new Response('down', { status: 503 })
        const path = url.split('/table/v1/driving/')[1].split('?')[0]
        const coords = path.split(';').map((c) => {
          const [lng, lat] = c.split(',').map(Number)
          return { lat, lng }
        })
        const [pickup, ...points] = coords
        const rows = points.map((p, i) => stub.drive(i, pickup, p))
        return json({
          code: 'Ok',
          durations: [rows.map((r) => (r ? r[0] * 60 : null))],
          distances: [rows.map((r) => (r ? r[1] * 1000 : null))],
          destinations: points.map((p, i) => ({
            // an OSRM snap moves the point; emulate by nudging north by snapMeters
            location: [p.lng, p.lat + (rows[i]?.[2] ?? 0) / 111320],
          })),
        })
      }
      throw new Error(`unexpected fetch: ${url}`)
    })
  )
}

const base: SearchRequest = {
  pickup: 'centraal',
  destination: 'vondelpark',
  maxWalkingMinutes: 10,
  provider: 'bolt',
}

let stub: Stub
beforeEach(() => {
  delete process.env.ORS_API_KEY
  stub = { drive: roadLike, osrmCalls: [] }
})
afterEach(() => vi.unstubAllGlobals())

describe('runSearch', () => {
  it('says "just ride" on an ordinary linear-fare trip', async () => {
    installFetchStub(stub)
    const r = await runSearch(base)
    expect(r.verdict).toBe('ride')
    expect(r.routingSource).toBe('osrm')
    expect(r.direct.fareSource).toBe('model')
    // still shows the closest calls, all of which lose after time is counted
    expect(r.options.length).toBeGreaterThan(0)
    for (const o of r.options) expect(o.net).toBeLessThan(1)
    // one OSRM request covers every candidate
    expect(stub.osrmCalls).toHaveLength(1)
  })

  it('recommends walking when the destination is behind a long detour', async () => {
    stub.drive = (i, pickup, point) => (i === 0 ? [30, 12, 0] : roadLike(i, pickup, point))
    installFetchStub(stub)
    const r = await runSearch(base)
    expect(r.verdict).toBe('walk')
    expect(r.best!.net).toBeGreaterThan(1)
    expect(r.best!.extraMinutes).toBeLessThan(0) // faster overall, not just cheaper
    expect(r.options.length).toBeLessThanOrEqual(3)
    expect(r.options[0].label).toBe('Teststraat 1')
    expect(r.options.map((o) => o.net)).toEqual([...r.options.map((o) => o.net)].sort((a, b) => b - a))
  })

  it('uses the real quote as the direct fare and scales estimates to it', async () => {
    installFetchStub(stub)
    const plain = await runSearch(base)

    // a quote equal to the model changes nothing
    const same = await runSearch({ ...base, directQuote: plain.direct.fare })
    expect(same.calibration!.multiplier).toBeCloseTo(1, 5)
    expect(same.options.map((o) => [o.id, o.fare])).toEqual(plain.options.map((o) => [o.id, o.fare]))

    // a surge quote (2x) doubles the direct fare and every fare saved, so walking pays more
    const surged = await runSearch({ ...base, directQuote: plain.direct.fare * 2 })
    expect(surged.direct.fareSource).toBe('quote')
    expect(surged.direct.fare).toBeCloseTo(plain.direct.fare * 2, 2)
    expect(surged.calibration!.multiplier).toBeCloseTo(2, 2)
    expect(surged.best!.net).toBeGreaterThan(plain.best!.net)
    for (const o of surged.options) expect(o.fare).toBeGreaterThan(plain.direct.fare) // 2x scale
  })

  it('skips candidates a car cannot reach or that snap too far from where they were', async () => {
    stub.drive = (i, pickup, point) => {
      if (i === 0) return roadLike(i, pickup, point)
      if (i % 2 === 0) return null // unroutable
      if (i % 3 === 0) return [5, 2, 500] // nearest road 500 m away (canal / park)
      return roadLike(i, pickup, point)
    }
    installFetchStub(stub)
    const r = await runSearch(base)
    expect(r.options.length).toBeGreaterThan(0)
  })

  it('degrades to straight-line estimates, with a warning, when routing is down', async () => {
    stub.osrmFails = true
    installFetchStub(stub)
    const r = await runSearch(base)
    expect(r.routingSource).toBe('estimated')
    expect(r.warnings.join(' ')).toMatch(/routing is unavailable/i)
  })

  it('reports walking times as estimated without an ORS key', async () => {
    installFetchStub(stub)
    const r = await runSearch(base)
    expect(r.walkingSource).toBe('estimated')
    expect(r.warnings.join(' ')).toMatch(/Walking times/)
  })

  it('surfaces an unknown place as a 422', async () => {
    installFetchStub(stub)
    await expect(runSearch({ ...base, destination: 'nowhere at all' })).rejects.toMatchObject({
      status: 422,
    })
  })

  it('fails clearly when the destination has no drivable route', async () => {
    stub.drive = (i, p, q) => (i === 0 ? null : roadLike(i, p, q))
    installFetchStub(stub)
    await expect(runSearch(base)).rejects.toBeInstanceOf(SearchError)
  })
})

describe('decodePolyline', () => {
  it('decodes the canonical Google example', () => {
    const pts = decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@')
    expect(pts).toHaveLength(3)
    expect(pts[0][0]).toBeCloseTo(-120.2, 5) // lng
    expect(pts[0][1]).toBeCloseTo(38.5, 5) // lat
    expect(pts[2][1]).toBeCloseTo(43.252, 5)
  })
})
