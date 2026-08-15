import { getEmailBaseUrl } from "@/lib/email-url"
import { WhatsappMetaAppInventory } from "@/modules/whatsapp/meta-apps/ui/meta-app-inventory"

export default function PortalWhatsAppMetaAppsPage() {
  return (
    <main className="flex flex-1 flex-col">
      <WhatsappMetaAppInventory baseUrl={getEmailBaseUrl()} />
    </main>
  )
}
