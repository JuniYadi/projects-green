import { Metadata } from "next"
import { WhatsAppInboxView } from "@/modules/whatsapp/conversations/ui/whatsapp-inbox-view"

export const metadata: Metadata = {
  title: "WhatsApp Operations Inbox | Console",
  description:
    "Manage WhatsApp customer conversations, lifecycle status, internal notes, and direct replies.",
}

export default function WhatsAppInboxPage() {
  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <WhatsAppInboxView />
    </main>
  )
}
