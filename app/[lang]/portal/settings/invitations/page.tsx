import { withAuth } from "@workos-inc/authkit-nextjs"
import { redirect } from "next/navigation"

import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { SettingsHeader } from "@/modules/tenants/ui/settings-header"
import { resolveSidebarOrganization } from "@/lib/sidebar-session"
import { InvitationsView } from "./invitations-view"

export default async function InvitationsPage({
  params,
}: Readonly<{
  params: Promise<{
    lang: string
  }>
}>) {
  const { lang } = await params
  const locale = resolveLocaleOrDefault(lang)
  const auth = await withAuth({ ensureSignedIn: true })

  if (!auth.organizationId) {
    redirect(localizePathname({ pathname: "/onboarding/organization", locale }))
  }

  const organization = await resolveSidebarOrganization(auth.organizationId)

  return (
    <main className="flex flex-1 flex-col pb-10">
      <SettingsHeader
        title="Invitations"
        description="Invite new members and manage pending invitations"
        organizationName={organization.name ?? undefined}
      />
      <div className="p-6">
        <InvitationsView organizationId={auth.organizationId} />
      </div>
    </main>
  )
}
