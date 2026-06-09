import { redirect } from "next/navigation"

import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"

type PortalSettingsOwnershipRedirectProps = {
  params: Promise<{ lang: string }>
}

export default async function PortalSettingsOwnershipRedirect({
  params,
}: PortalSettingsOwnershipRedirectProps) {
  const { lang } = await params
  const locale = resolveLocaleOrDefault(lang)

  redirect(localizePathname({ pathname: "/console/organization/ownership", locale }))
}
