import { withAuth } from "@workos-inc/authkit-nextjs"
import { redirect } from "next/navigation"

import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { OrganizationAdminSurface } from "@/modules/tenants/ui/organization-admin-surface"

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

  return <OrganizationAdminSurface organizationId={auth.organizationId} />
}
