import { PaymentTabs } from "./payment-tabs"

export default async function PaymentsPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    tab?: string
  }>
}>) {
  const { tab } = await searchParams
  const defaultTab = tab || "overview"

  return <PaymentTabs defaultTab={defaultTab} />
}
