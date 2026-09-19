import { withAuth } from "@workos-inc/authkit-nextjs"
import type { Metadata } from "next"

import { getPlatformRoleForUser } from "@/lib/platform-role"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { TemplatesPageClient } from "./templates-page-client"

export const metadata: Metadata = { title: "Templates" }

type Props = {
  params: Promise<{ lang: string }>
  searchParams: Promise<Record<string, string>>
}

export default async function PortalTemplatesPage({ params }: Props) {
  const { lang } = await params
  const locale = resolveLocaleOrDefault(lang)
  const messages = getMessages(locale).pPortalPages.whatsappTemplates
  const auth = await withAuth({ ensureSignedIn: true })
  const platformRole = await getPlatformRoleForUser({
    id: auth.user.id,
    email: auth.user.email,
  })
  const isSuperAdmin = platformRole === "super_admin"

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{messages.heading}</h1>
        <p className="text-muted-foreground">
          {messages.description}
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{messages.cardTitle}</CardTitle>
            <CardDescription>{messages.cardDescription}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <TemplatesPageClient isSuperAdmin={isSuperAdmin} />
        </CardContent>
      </Card>
    </main>
  )
}
