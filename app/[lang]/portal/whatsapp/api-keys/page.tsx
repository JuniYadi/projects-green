import type { Metadata } from "next"

import { WhatsappOrganizationApiKeyInventory } from "@/modules/whatsapp/organization-api-keys/ui/organization-api-key-inventory"

export const metadata: Metadata = { title: "Organization API Keys" }

export default function PortalWhatsAppApiKeysPage() {
  return (
    <main className="flex flex-1 flex-col">
      <WhatsappOrganizationApiKeyInventory />
    </main>
  )
}
