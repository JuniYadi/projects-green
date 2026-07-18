import { redirect } from "next/navigation"

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>
}) {
  const { id } = await params
  redirect(`/portal/billing/invoices/${id}`)
}
