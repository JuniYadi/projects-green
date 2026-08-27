import type { ServiceType } from "@prisma/client"

import type { ProductProvisionAdapter } from "./product-provision-adapter.types"

const adapters = new Map<ServiceType, ProductProvisionAdapter>()

export function registerAdapter<TConfig>(
  adapter: ProductProvisionAdapter<TConfig>
): void {
  if (adapters.has(adapter.id)) {
    throw new Error(`Provision adapter "${adapter.id}" is already registered`)
  }

  adapters.set(adapter.id, adapter as ProductProvisionAdapter)
}

export function getProvisionAdapter(
  serviceType: ServiceType,
  fallback?: ProductProvisionAdapter
): ProductProvisionAdapter | undefined {
  return adapters.get(serviceType) ?? fallback
}

export function hasProvisionAdapter(serviceType: ServiceType): boolean {
  return adapters.has(serviceType)
}

export function listProvisionAdapters(): ProductProvisionAdapter[] {
  return Array.from(adapters.values())
}

export function clearProvisionAdapters(): void {
  adapters.clear()
}
