/**
 * Provider registry and factory.
 *
 * To add a new provider (e.g. Lyft, Grab):
 * 1. Create providers/lyft.ts implementing FareProvider
 * 2. Add to PROVIDERS map below
 * 3. No other changes required
 */

import { UberAdapter } from './uber'
import { BoltAdapter } from './bolt'
import type { FareProvider } from './types'

/** All registered fare providers */
const PROVIDERS: Record<string, FareProvider> = {
  uber: new UberAdapter(),
  bolt: new BoltAdapter(),
}

/**
 * Get a single provider by name.
 * Throws if the provider is not registered.
 */
export function getProvider(name: string): FareProvider {
  const provider = PROVIDERS[name.toLowerCase()]
  if (!provider) {
    throw new Error(
      `Unknown provider: "${name}". Available: ${Object.keys(PROVIDERS).join(', ')}`
    )
  }
  return provider
}

/**
 * Get multiple providers by name, or all providers if names is empty.
 */
export function getProviders(names?: string[]): FareProvider[] {
  if (!names || names.length === 0) {
    return Object.values(PROVIDERS)
  }
  return names.map(getProvider)
}

/** Get all available provider names */
export function getProviderNames(): string[] {
  return Object.keys(PROVIDERS)
}

export type { FareProvider }
export { UberAdapter } from './uber'
export { BoltAdapter } from './bolt'
