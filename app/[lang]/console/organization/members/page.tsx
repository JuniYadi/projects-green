import { withAuth } from "@workos-inc/authkit-nextjs"
import { redirect } from "next/navigation"

import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { MembersList } from "@/app/[lang]/portal/settings/members/members-list"

const ONBOARDING_PATH = "/onboarding/organization"

type ConsoleOrganizationMembersPageProps = {
  params: Promise<{ lang: string }>
}

export default async function ConsoleOrganizationMembersPage({
  params,
}: ConsoleOrganizationMembersPageProps) {
  const { lang } = await params
  const locale = resolveLocaleOrDefault(lang)
  const auth = await withAuth({ ensureSignedIn: true })

  if (!auth.organizationId) {
    const onboardingPath = localizePathname({ pathname: ONBOARDING_PATH, locale })
    const nextPath = localizePathname({ pathname: "/console/organization/members", locale })
    redirect(`${onboardingPath}?next=${encodeURIComponent(nextPath)}`)
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Organization Members</h1>
        <p className="text-sm text-muted-foreground">
          Manage member roles and access for the active organization.
        </p>
      </header>
      <MembersList organizationId={auth.organizationId} />
    </main>
  )
}
