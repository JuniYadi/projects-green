import type { Metadata } from "next"

import { AdminWhatsappAnalyticsView } from "@/modules/whatsapp/analytics/ui/admin-whatsapp-analytics-view"

export const metadata: Metadata = { title: "WhatsApp Analytics & Profit" }

export default function PortalWhatsappAnalyticsPage() {
  return <AdminWhatsappAnalyticsView />
}
