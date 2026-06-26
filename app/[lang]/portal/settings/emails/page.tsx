import { withAuth } from "@workos-inc/authkit-nextjs"
import { redirect } from "next/navigation"
import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { getPlatformAccessForUser } from "@/lib/platform-role"
import { EmailsView } from "./emails-view"

export default async function EmailTemplatesPage({
  params,
}: Readonly<{
  params: Promise<{ lang: string }>
}>) {
  const { lang } = await params
  const locale = resolveLocaleOrDefault(lang)
  const auth = await withAuth({ ensureSignedIn: true })

  const platformAccess = await getPlatformAccessForUser({
    id: auth.user.id,
    email: auth.user.email,
  })

  if (!platformAccess.exists) {
    redirect(localizePathname({ pathname: "/portal", locale }))
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Email Templates</h1>
        <p className="text-sm text-muted-foreground">
          Preview all transactional email templates sent by the platform.
        </p>
      </header>
      <EmailsView />
    </main>
  )
}
