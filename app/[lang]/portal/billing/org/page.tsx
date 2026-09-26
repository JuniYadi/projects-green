import { redirect } from "next/navigation"

export default async function PortalBillingOrgPage({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  redirect(`/${lang}/portal/orgs`)
}
