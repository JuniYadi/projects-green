import { redirect } from "next/navigation"

export default async function PortalAppEventsPage({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  redirect(`/${lang}/portal/app/events/github`)
}
