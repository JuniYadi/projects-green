import { redirect } from "next/navigation"

export default async function PortalBillingCatalogProductsPage({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  redirect(`/${lang}/portal/billing/catalog`)
}
