import { redirect } from "next/navigation"

export default async function PortalSystemPage({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  redirect(`/${lang}/portal/system/cronjobs`)
}
