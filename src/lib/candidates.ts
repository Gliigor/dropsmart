/**
 * Candidate drop-off generation.
 *
 * A drop-off on the far side of the destination can only cost more, so candidates
 * are laid out in rings on the half of the circle that faces the pickup. Rings are
 * later snapped to real roads and de-duplicated, so overlap here is harmless.
 */

import { bearingDegrees, bearingToCompass, distanceMeters, offsetCoordinate } from './geo'
import type { Coordinates } from './types'

/** Straight-line meters a person covers per minute, leaving room for real-path detours. */
const STRAIGHT_LINE_M_PER_MIN = 65

const RING_FRACTIONS = [0.4, 0.6, 0.8, 1.0]
const ARC_HALF_WIDTH_DEG = 100
const ARC_STEP_DEG = 20

/** If pickup and destination are this close there is no meaningful "facing" direction. */
const NEAR_METERS = 300

export interface RawCandidate extends Coordinates {
  bearing: number
}

export function generateCandidates(
  pickup: Coordinates,
  destination: Coordinates,
  maxWalkingMinutes: number
): RawCandidate[] {
  const maxRadius = maxWalkingMinutes * STRAIGHT_LINE_M_PER_MIN
  const towardPickup = bearingDegrees(destination, pickup)
  const fullCircle = distanceMeters(pickup, destination) < NEAR_METERS

  const offsets: number[] = []
  if (fullCircle) {
    for (let a = 0; a < 360; a += 30) offsets.push(a)
  } else {
    for (let a = -ARC_HALF_WIDTH_DEG; a <= ARC_HALF_WIDTH_DEG; a += ARC_STEP_DEG) offsets.push(a)
  }

  const out: RawCandidate[] = []
  for (const fraction of RING_FRACTIONS) {
    for (const offset of offsets) {
      const bearing = (((fullCircle ? offset : towardPickup + offset) % 360) + 360) % 360
      out.push({ ...offsetCoordinate(destination, maxRadius * fraction, bearing), bearing })
    }
  }
  return out
}

export function compassFor(bearing: number): string {
  return bearingToCompass(bearing)
}
