import { withAuth } from "@workos-inc/authkit-nextjs"
import { redirect } from "next/navigation"

import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { InvitationsView } from "@/app/[lang]/portal/settings/invitations/invitations-view"

const ONBOARDING_PATH = "/onboarding/organization"

type ConsoleOrganizationInvitationsPageProps = {
  params: Promise<{ lang: string }>
}

export default async function ConsoleOrganizationInvitationsPage({
  params,
}: ConsoleOrganizationInvitationsPageProps) {
  const { lang } = await params
  const locale = resolveLocaleOrDefault(lang)
  const auth = await withAuth({ ensureSignedIn: true })

  if (!auth.organizationId) {
    const onboardingPath = localizePathname({ pathname: ONBOARDING_PATH, locale })
    const nextPath = localizePathname({ pathname: "/console/organization/invitations", locale })
    redirect(`${onboardingPath}?next=${encodeURIComponent(nextPath)}`)
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Organization Invitations</h1>
        <p className="text-sm text-muted-foreground">
          Invite users and manage pending invitations for the active organization.
        </p>
      </header>
      <InvitationsView organizationId={auth.organizationId} />
    </main>
  )
}
