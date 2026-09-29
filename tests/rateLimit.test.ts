import { afterEach, describe, expect, it } from 'vitest'
import { checkRateLimit } from '@/lib/rateLimit'

afterEach(() => {
  delete process.env.RATE_LIMIT_PER_DAY
})

describe('checkRateLimit', () => {
  it('is unlimited by default', () => {
    for (let i = 0; i < 50; i++) {
      const r = checkRateLimit('ip-default')
      expect(r.allowed).toBe(true)
      expect(r.remaining).toBeNull()
    }
  })

  it('caps searches per IP when RATE_LIMIT_PER_DAY is set', () => {
    process.env.RATE_LIMIT_PER_DAY = '2'
    expect(checkRateLimit('ip-capped')).toMatchObject({ allowed: true, remaining: 1 })
    expect(checkRateLimit('ip-capped')).toMatchObject({ allowed: true, remaining: 0 })
    expect(checkRateLimit('ip-capped')).toMatchObject({ allowed: false, remaining: 0 })
    expect(checkRateLimit('other-ip').allowed).toBe(true)
  })
})
