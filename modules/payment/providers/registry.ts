import type { PaymentProvider, ConfigFieldDef } from "./provider.interface"

const providers = new Map<string, PaymentProvider>()

/**
 * Register a payment provider in the global registry.
 * Throws if a provider with the same id is already registered.
 */
export function registerProvider(provider: PaymentProvider): void {
  if (providers.has(provider.id)) {
    throw new Error(`Provider "${provider.id}" is already registered`)
  }
  providers.set(provider.id, provider)
}

/**
 * Remove a registered provider by id. Used in tests to clean up.
 */
export function deregisterProvider(id: string): void {
  providers.delete(id)
}

/**
 * Clear all registered providers. Used in tests.
 */
export function clearProviders(): void {
  providers.clear()
}

/**
 * Get a registered provider by id.
 */
export function getProvider(id: string): PaymentProvider | undefined {
  return providers.get(id)
}

/**
 * List all registered providers.
 */
export function listProviders(): PaymentProvider[] {
  return Array.from(providers.values())
}

/**
 * Find a provider that supports a given currency and payment method.
 * Returns the first matching provider, or undefined.
 */
export function findProvider(
  currency: string,
  paymentMethod: string
): PaymentProvider | undefined {
  return Array.from(providers.values()).find(
    (p) =>
      p.supportedCurrencies.includes(currency) &&
      p.paymentMethods.includes(paymentMethod)
  )
}

/**
 * Get config field definitions for a provider.
 * Convenience wrapper used by the UI form builder.
 */
export function getProviderConfigFields(providerId: string): ConfigFieldDef[] {
  const provider = providers.get(providerId)
  if (!provider) return []
  return provider.configFields
}

// Re-export for convenience
export type {
  PaymentProvider,
  ConfigFieldDef,
  PaymentResult,
  PaymentRequest,
} from "./provider.interface"
