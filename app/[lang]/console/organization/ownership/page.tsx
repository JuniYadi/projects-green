import { withAuth } from "@workos-inc/authkit-nextjs"
import { redirect } from "next/navigation"

import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { OwnershipView } from "@/app/[lang]/portal/settings/ownership/ownership-view"

const ONBOARDING_PATH = "/onboarding/organization"

type ConsoleOrganizationOwnershipPageProps = {
  params: Promise<{ lang: string }>
}

export default async function ConsoleOrganizationOwnershipPage({
  params,
}: ConsoleOrganizationOwnershipPageProps) {
  const { lang } = await params
  const locale = resolveLocaleOrDefault(lang)
  const auth = await withAuth({ ensureSignedIn: true })

  if (!auth.organizationId) {
    const onboardingPath = localizePathname({ pathname: ONBOARDING_PATH, locale })
    const nextPath = localizePathname({ pathname: "/console/organization/ownership", locale })
    redirect(`${onboardingPath}?next=${encodeURIComponent(nextPath)}`)
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Organization Ownership</h1>
        <p className="text-sm text-muted-foreground">
          Transfer ownership for the active organization when policy allows it.
        </p>
      </header>
      <OwnershipView organizationId={auth.organizationId} />
    </main>
  )
}
