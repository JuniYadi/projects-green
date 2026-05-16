import { withAuth } from "@workos-inc/authkit-nextjs"
import { redirect } from "next/navigation"

import { OrganizationAdminSurface } from "@/modules/tenants/ui/organization-admin-surface"

const ONBOARDING_PATH = "/onboarding/organization"

export default async function ConsoleOrganizationPage() {
  const auth = await withAuth({ ensureSignedIn: true })

  if (!auth.organizationId) {
    redirect(
      `${ONBOARDING_PATH}?next=${encodeURIComponent("/console/organization")}`
    )
  }

  return <OrganizationAdminSurface organizationId={auth.organizationId} />
}
