import { describe, expect, it } from 'vitest'
import { generateCandidates } from '@/lib/candidates'
import { bearingDegrees, bearingToCompass, distanceMeters, offsetCoordinate } from '@/lib/geo'

const centraal = { lat: 52.3791, lng: 4.9003 }
const vondelpark = { lat: 52.3579, lng: 4.8686 }

describe('geo', () => {
  it('offset and distance agree', () => {
    const p = offsetCoordinate(centraal, 500, 90)
    expect(distanceMeters(centraal, p)).toBeCloseTo(500, 0)
    expect(bearingDegrees(centraal, p)).toBeCloseTo(90, 0)
  })

  it('names compass directions', () => {
    expect(bearingToCompass(0)).toBe('N')
    expect(bearingToCompass(359)).toBe('N')
    expect(bearingToCompass(225)).toBe('SW')
  })
})

describe('generateCandidates', () => {
  it('only places points on the pickup-facing side', () => {
    const toPickup = bearingDegrees(vondelpark, centraal)
    const cands = generateCandidates(centraal, vondelpark, 10)
    expect(cands.length).toBeGreaterThan(20)
    for (const c of cands) {
      // angular difference between the candidate's bearing and the direction to the pickup
      const off = Math.abs(((c.bearing - toPickup + 540) % 360) - 180)
      expect(off).toBeLessThanOrEqual(100.001)
    }
  })

  it('stays within the walking radius', () => {
    for (const c of generateCandidates(centraal, vondelpark, 5)) {
      expect(distanceMeters(vondelpark, c)).toBeLessThanOrEqual(5 * 65 + 1)
    }
  })

  it('uses a full circle when pickup and destination are close', () => {
    const near = offsetCoordinate(centraal, 100, 45)
    const bearings = new Set(generateCandidates(centraal, near, 5).map((c) => Math.round(c.bearing)))
    expect(bearings.size).toBe(12)
  })
})
