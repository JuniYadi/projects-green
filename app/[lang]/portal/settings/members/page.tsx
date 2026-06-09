import { redirect } from "next/navigation"

import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"

type PortalSettingsMembersRedirectProps = {
  params: Promise<{ lang: string }>
}

export default async function PortalSettingsMembersRedirect({
  params,
}: PortalSettingsMembersRedirectProps) {
  const { lang } = await params
  const locale = resolveLocaleOrDefault(lang)

  redirect(localizePathname({ pathname: "/console/organization/members", locale }))
}
