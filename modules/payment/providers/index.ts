import { registerProvider } from "./registry"
import { duitkuProvider } from "./duitku.provider"
import { paypalProvider } from "./paypal.provider"

// Register all built-in providers on import.
registerProvider(duitkuProvider)
registerProvider(paypalProvider)

export { registerProvider, getProvider, listProviders, findProvider, getProviderConfigFields } from "./registry"
export type { PaymentProvider, ConfigFieldDef, PaymentResult, PaymentRequest } from "./provider.interface"
export { duitkuProvider } from "./duitku.provider"
export { paypalProvider } from "./paypal.provider"
