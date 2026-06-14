import { withAuth } from "@workos-inc/authkit-nextjs"
import { redirect } from "next/navigation"
import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { OwnershipView } from "./ownership-view"

export default async function OwnershipPage({
  params,
}: Readonly<{
  params: Promise<{ lang: string }>
}>) {
  const { lang } = await params
  const locale = resolveLocaleOrDefault(lang)
  const auth = await withAuth({ ensureSignedIn: true })

  if (!auth.organizationId) {
    redirect(localizePathname({ pathname: "/portal", locale }))
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Ownership</h1>
        <p className="text-sm text-muted-foreground">
          View the current organization owner and transfer ownership.
        </p>
      </header>
      <OwnershipView organizationId={auth.organizationId} />
    </main>
  )
}
