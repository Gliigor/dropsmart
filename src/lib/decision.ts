/**
 * The decision rule: is walking the last stretch actually worth it?
 *
 * For every candidate drop-off we compare the WHOLE journey with the direct ride:
 *   savings   = directFare − fare
 *   timeCost  = ((drive + walk) − (directDrive + directWalk)) × valueOfTimePerMin
 *   net       = savings − timeCost
 *
 * Only a positive net beats just taking the ride. Note timeCost can be negative:
 * when the destination sits behind one-way streets, canals or a car-free zone,
 * dropping off nearby and walking can be *faster* than driving all the way round.
 */

export interface JourneyLeg {
  fare: number
  driveMinutes: number
  walkMinutes: number
}

export interface Evaluation {
  savings: number
  extraMinutes: number
  timeCost: number
  net: number
}

/** A walk has to be worth at least this much (€) after time cost to be recommended. */
export const MIN_NET_BENEFIT = 1.0

/** Default value of the user's time when none is supplied (€ per hour). */
export const DEFAULT_VALUE_OF_TIME_PER_HOUR = 15

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function evaluateOption(
  direct: JourneyLeg,
  option: JourneyLeg,
  valueOfTimePerMin: number
): Evaluation {
  const savings = round2(direct.fare - option.fare)
  const extraMinutes =
    option.driveMinutes + option.walkMinutes - (direct.driveMinutes + direct.walkMinutes)
  const timeCost = round2(extraMinutes * valueOfTimePerMin)
  return { savings, extraMinutes: round2(extraMinutes), timeCost, net: round2(savings - timeCost) }
}

export function isWorthWalking(net: number): boolean {
  return net >= MIN_NET_BENEFIT
}
