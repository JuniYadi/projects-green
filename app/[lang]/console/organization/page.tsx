import { withAuth } from "@workos-inc/authkit-nextjs"
import { redirect } from "next/navigation"

import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { OrganizationTabs } from "./organization-tabs"

const ONBOARDING_PATH = "/onboarding/organization"

type ConsoleOrganizationPageProps = {
  params: Promise<{
    lang: string
  }>
}

export default async function ConsoleOrganizationPage({
  params,
}: ConsoleOrganizationPageProps) {
  const { lang } = await params
  const locale = resolveLocaleOrDefault(lang)
  const auth = await withAuth({ ensureSignedIn: true })

  if (!auth.organizationId) {
    const onboardingPath = localizePathname({
      pathname: ONBOARDING_PATH,
      locale,
    })
    const consoleOrganizationPath = localizePathname({
      pathname: "/console/organization",
      locale,
    })

    redirect(
      `${onboardingPath}?next=${encodeURIComponent(consoleOrganizationPath)}`
    )
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Organization Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage members, invitations, and ownership for the active organization.
        </p>
      </header>
      <OrganizationTabs organizationId={auth.organizationId} />
    </main>
  )
}
