import { describe, expect, it } from 'vitest'
import { evaluateOption, isWorthWalking, MIN_NET_BENEFIT } from '@/lib/decision'
import { FARE_PROFILES, calibrationMultiplier, modelFare, scaleFare } from '@/lib/fare'

const direct = { fare: 12, driveMinutes: 15, walkMinutes: 0 }

describe('evaluateOption', () => {
  it('counts the walk against the fare saved', () => {
    // saves €2, 8 min walk, 2 min less driving => 6 min extra at €0.25/min = €1.50
    const ev = evaluateOption(direct, { fare: 10, driveMinutes: 13, walkMinutes: 8 }, 0.25)
    expect(ev.savings).toBe(2)
    expect(ev.extraMinutes).toBe(6)
    expect(ev.timeCost).toBe(1.5)
    expect(ev.net).toBe(0.5)
    expect(isWorthWalking(ev.net)).toBe(false)
  })

  it('never recommends a walk that costs more than it saves (the original app bug)', () => {
    // €2 saved by a 16 min walk at €0.40/min
    const ev = evaluateOption(direct, { fare: 10, driveMinutes: 15, walkMinutes: 16 }, 0.4)
    expect(ev.net).toBeLessThan(0)
    expect(isWorthWalking(ev.net)).toBe(false)
  })

  it('credits time when dropping off is faster overall (detour / one-way streets)', () => {
    const detour = { fare: 15, driveMinutes: 25, walkMinutes: 0 }
    const ev = evaluateOption(detour, { fare: 9, driveMinutes: 10, walkMinutes: 6 }, 0.4)
    expect(ev.extraMinutes).toBe(-9)
    expect(ev.timeCost).toBe(-3.6)
    expect(ev.net).toBe(9.6)
    expect(isWorthWalking(ev.net)).toBe(true)
  })

  it('treats free time as free', () => {
    const ev = evaluateOption(direct, { fare: 10, driveMinutes: 15, walkMinutes: 16 }, 0)
    expect(ev.net).toBe(2)
  })

  it('has a minimum benefit threshold', () => {
    expect(isWorthWalking(MIN_NET_BENEFIT - 0.01)).toBe(false)
    expect(isWorthWalking(MIN_NET_BENEFIT)).toBe(true)
  })
})

describe('fare model', () => {
  it('applies the minimum fare to short rides', () => {
    expect(modelFare(FARE_PROFILES.uber, { km: 0.3, minutes: 1 })).toBe(FARE_PROFILES.uber.minFare)
  })

  it('grows with distance and time', () => {
    const short = modelFare(FARE_PROFILES.bolt, { km: 3, minutes: 8 })
    const long = modelFare(FARE_PROFILES.bolt, { km: 6, minutes: 16 })
    expect(long).toBeGreaterThan(short)
    // 1.80 + 0.95*3 + 0.15*8 = 5.85
    expect(short).toBe(5.85)
  })

  it('calibrates to a real quote, e.g. surge', () => {
    const modelled = modelFare(FARE_PROFILES.bolt, { km: 5, minutes: 14 }) // 8.65
    const k = calibrationMultiplier(17.3, modelled)
    expect(k).toBeCloseTo(2, 5)
    expect(scaleFare(modelled, k!)).toBe(17.3)
  })

  it('clamps absurd quotes and rejects unusable input', () => {
    expect(calibrationMultiplier(1000, 10)).toBe(4)
    expect(calibrationMultiplier(0.1, 10)).toBe(0.5)
    expect(calibrationMultiplier(-5, 10)).toBeNull()
    expect(calibrationMultiplier(10, 0)).toBeNull()
    expect(calibrationMultiplier(NaN, 10)).toBeNull()
  })

  it('surge makes walking pay off more, as it should', () => {
    // Same route as 1 km closer: calibrated x2 doubles the fare saved
    const near = modelFare(FARE_PROFILES.bolt, { km: 6, minutes: 16 })
    const far = modelFare(FARE_PROFILES.bolt, { km: 5, minutes: 13.5 })
    const normal = evaluateOption(
      { fare: near, driveMinutes: 16, walkMinutes: 0 },
      { fare: far, driveMinutes: 13.5, walkMinutes: 13 },
      0.25
    )
    const surged = evaluateOption(
      { fare: near * 2, driveMinutes: 16, walkMinutes: 0 },
      { fare: far * 2, driveMinutes: 13.5, walkMinutes: 13 },
      0.25
    )
    expect(surged.net).toBeGreaterThan(normal.net)
  })
})
