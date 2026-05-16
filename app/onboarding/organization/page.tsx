import { withAuth } from "@workos-inc/authkit-nextjs"
import { redirect } from "next/navigation"

import { OrganizationOnboarding } from "@/modules/tenants/ui/organization-onboarding"

const getSafeNext = (next: string | undefined) => {
  if (!next || !next.startsWith("/")) {
    return "/console"
  }

  return next
}

type OnboardingPageProps = {
  searchParams?: Promise<{
    next?: string
  }>
}

export default async function OrganizationOnboardingPage({
  searchParams,
}: OnboardingPageProps) {
  const auth = await withAuth({ ensureSignedIn: true })
  const params = await searchParams
  const nextPath = getSafeNext(params?.next)

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
