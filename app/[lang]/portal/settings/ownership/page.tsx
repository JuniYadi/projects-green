import { withAuth } from "@workos-inc/authkit-nextjs"
import { redirect } from "next/navigation"

import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { resolveSidebarOrganization } from "@/lib/sidebar-session"
import { OwnershipView } from "./ownership-view"

export default async function OwnershipPage({
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
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Ownership</h1>
        <p className="text-sm text-muted-foreground">
          Manage organization ownership and transfer
          {organization.name && (
            <> for <span className="font-medium">{organization.name}</span></>
          )}
        </p>
      </header>
      <OwnershipView organizationId={auth.organizationId} />
    </main>
  )
}
