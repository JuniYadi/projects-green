import { withAuth } from "@workos-inc/authkit-nextjs"
import { redirect } from "next/navigation"

import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { OrganizationOnboarding } from "@/modules/tenants/ui/organization-onboarding"

const getSafeNext = (next: string | undefined, fallbackPath: string) => {
  if (!next || !next.startsWith("/")) {
    return fallbackPath
  }

  return next
}

type OnboardingPageProps = {
  params: Promise<{
    lang: string
  }>
  searchParams?: Promise<{
    next?: string
  }>
}

export default async function OrganizationOnboardingPage({
  searchParams,
  params,
}: OnboardingPageProps) {
  const { lang } = await params
  const locale = resolveLocaleOrDefault(lang)
  const auth = await withAuth({ ensureSignedIn: true })
  const search = await searchParams
  const fallbackPath = localizePathname({ pathname: "/console", locale })
  const nextPath = getSafeNext(search?.next, fallbackPath)

  if (auth.organizationId) {
    redirect(nextPath)
  }

  return (
    <main className="mx-auto min-h-svh w-full max-w-3xl space-y-6 p-6 md:p-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Set up your organization</h1>
        <p className="text-sm text-muted-foreground">
          Create your first organization or join one where you already have an
          active membership.
        </p>
      </header>
      <OrganizationOnboarding nextPath={nextPath} />
    </main>
  )
}
