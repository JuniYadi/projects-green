import { redirect } from "next/navigation"

import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"

type ConsoleVpnOrderPageProps = {
  params: Promise<{ lang: string }>
}

export default async function ConsoleVpnOrderPage({
  params,
}: ConsoleVpnOrderPageProps) {
  const { lang } = await params
  const locale = resolveLocaleOrDefault(lang)

  redirect(
    localizePathname({
      pathname: "/console/billing/services/vpn",
      locale,
    })
  )
}
