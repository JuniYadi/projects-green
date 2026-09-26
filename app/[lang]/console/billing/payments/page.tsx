import { redirect } from "next/navigation"

export default async function ConsoleBillingPaymentsPage({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  redirect(`/${lang}/console/billing`)
}
