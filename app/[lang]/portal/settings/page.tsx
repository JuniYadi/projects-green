import { redirect } from "next/navigation"

export default async function PortalSettingsPage({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  redirect(`/${lang}/portal/settings/emails`)
}
