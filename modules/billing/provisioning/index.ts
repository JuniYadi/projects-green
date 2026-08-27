import { registerAdapter } from "./provision-adapter-registry"
import { VpnProvisionAdapter } from "./adapters/vpn-provision-adapter"
import { AppHostingProvisionAdapter } from "./adapters/app-hosting-provision-adapter"
import { WhatsAppProvisionAdapter } from "./adapters/whatsapp-provision-adapter"

export * from "./product-provision-adapter.types"
export * from "./provision-adapter-registry"
export * from "./adapters/vpn-provision-adapter"
export * from "./adapters/app-hosting-provision-adapter"
export * from "./adapters/whatsapp-provision-adapter"

registerAdapter(VpnProvisionAdapter)
registerAdapter(AppHostingProvisionAdapter)
registerAdapter(WhatsAppProvisionAdapter)
