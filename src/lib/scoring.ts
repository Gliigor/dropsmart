/**
 * Scoring algorithm for DropSmart.
 *
 * The score represents the true cost of a ride alternative,
 * combining the monetary ride cost with the opportunity cost of walking.
 *
 * Formula:
 *   score = rideCost + (walkingMinutes × walkingCostPerMinute)
 *
 * Where:
 *   - rideCost: estimated fare to the alternative drop-off point
 *   - walkingMinutes: actual walking time from drop-off to destination (from ORS)
 *   - walkingCostPerMinute: configurable value of time in €/min (default: €0.40)
 *
 * A lower score is always better.
 *
 * The direct ride to destination has score = directRideCost + 0 (no walking).
 *
 * Examples:
 *   Direct ride: €12.00, walk 0 min → score = 12.00
 *   Alternative: €9.00, walk 5 min  → score = 9.00 + (5 × 0.40) = 11.00 ✓ better
 *   Alternative: €8.00, walk 10 min → score = 8.00 + (10 × 0.40) = 12.00  same
 *   Alternative: €7.00, walk 15 min → score = 7.00 + (15 × 0.40) = 13.00  worse
 */

/** Default value of walking time: €0.40 per minute */
const DEFAULT_WALKING_COST_PER_MINUTE = 0.4

/**
 * Get the configured walking cost per minute.
 * Set via WALKING_COST_PER_MINUTE environment variable.
 */
export function getWalkingCostPerMinute(): number {
  const envVal = process.env.WALKING_COST_PER_MINUTE
  if (envVal) {
    const parsed = parseFloat(envVal)
    if (!isNaN(parsed) && parsed >= 0) return parsed
  }
  return DEFAULT_WALKING_COST_PER_MINUTE
}

/**
 * Calculate the combined score for an alternative drop-off option.
 *
 * @param rideCost - The estimated fare to the alternative drop-off point (in €)
 * @param walkingMinutes - Actual walking time from drop-off to destination (from ORS)
 * @returns Combined score in € (lower is better)
 */
export function calculateScore(rideCost: number, walkingMinutes: number): number {
  const walkingCostPerMinute = getWalkingCostPerMinute()
  const score = rideCost + walkingMinutes * walkingCostPerMinute
  return Math.round(score * 100) / 100
}

/**
 * Calculate monetary savings vs the direct ride.
 *
 * @param directFareCost - The estimated fare to the original destination (in €)
 * @param alternativeFareCost - The estimated fare to the alternative drop-off (in €)
 * @returns Savings in € (positive means cheaper)
 */
export function calculateSavings(
  directFareCost: number,
  alternativeFareCost: number
): number {
  const savings = directFareCost - alternativeFareCost
  return Math.round(savings * 100) / 100
}

/**
 * Minimum savings threshold to include an alternative.
 * Alternatives saving less than this are filtered out as not worth the hassle.
 * Value: €2.00
 */
export const MIN_SAVINGS_THRESHOLD = 2.0

/**
 * Determine if an alternative is worth showing based on savings threshold.
 *
 * @param savings - Calculated savings in €
 * @returns true if the alternative should be shown to the user
 */
export function isWorthShowing(savings: number): boolean {
  return savings >= MIN_SAVINGS_THRESHOLD
}
