import { redirect } from "next/navigation"

import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"

export default async function ConsoleVpnSubscriptionsPage({
  params,
}: {
  params: Promise<{ lang?: string }>
}) {
  const { lang } = await params
  const locale = resolveLocaleOrDefault(lang)
  redirect(localizePathname({ pathname: "/console/vpn/profiles", locale }))
}
