import { withAuth } from "@workos-inc/authkit-nextjs"
import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { getMessages } from "@/lib/i18n/messages"
import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { InvitationsView } from "./invitations-view"

export const metadata: Metadata = { title: "Invitations" }

export default async function InvitationsPage({
  params,
}: Readonly<{
  params: Promise<{ lang: string }>
}>) {
  const { lang } = await params
  const locale = resolveLocaleOrDefault(lang)
  const messages = getMessages(locale).pPortalPages.settingsInvitations
  const auth = await withAuth({ ensureSignedIn: true })

  if (!auth.organizationId) {
    redirect(localizePathname({ pathname: "/portal", locale }))
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">{messages.title}</h1>
        <p className="text-sm text-muted-foreground">
          {messages.description}
        </p>
      </header>
      <InvitationsView organizationId={auth.organizationId} />
    </main>
  )
}
