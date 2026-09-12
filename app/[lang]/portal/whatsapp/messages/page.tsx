import type { Metadata } from "next"

import { WhatsAppInbox } from "@/modules/whatsapp/messages/ui/whatsapp-inbox"

export const metadata: Metadata = { title: "Messages" }

export default function WhatsAppMessagesPage() {
  return <WhatsAppInbox isAdminMode={true} />
}
