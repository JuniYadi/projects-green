import type { Metadata } from "next"

import { InvoiceDetailScreen } from "@/modules/invoices/ui/invoice-detail-screen"

export const metadata: Metadata = { title: "Invoice Details" }

interface InvoiceDetailPageProps {
  params: Promise<{ id: string; lang: string }>
}

export default async function InvoiceDetailPage({
  params,
}: InvoiceDetailPageProps) {
  const { id, lang } = await params

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <InvoiceDetailScreen invoiceId={id} lang={lang} />
    </main>
  )
}
