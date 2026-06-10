import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { redirect } from "next/navigation"

import { localizePathname } from "@/lib/i18n/pathname"

type PageProps = {
  params: Promise<{ lang: string }>
}

export default async function ConsoleOrganizationInvitationsPage({
  params,
}: PageProps) {
  const { lang } = await params
  const locale = resolveLocaleOrDefault(lang)
  redirect(
    `${localizePathname({ pathname: "/console/organization", locale })}?tab=invitations`
  )
}
