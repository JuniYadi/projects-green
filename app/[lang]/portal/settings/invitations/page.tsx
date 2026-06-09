import { redirect } from "next/navigation"

import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"

type PortalSettingsInvitationsRedirectProps = {
  params: Promise<{ lang: string }>
}

export default async function PortalSettingsInvitationsRedirect({
  params,
}: PortalSettingsInvitationsRedirectProps) {
  const { lang } = await params
  const locale = resolveLocaleOrDefault(lang)

  redirect(localizePathname({ pathname: "/console/organization/invitations", locale }))
}
