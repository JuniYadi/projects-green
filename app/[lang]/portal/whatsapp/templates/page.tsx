import { withAuth } from "@workos-inc/authkit-nextjs"

import { getPlatformRoleForUser } from "@/lib/platform-role"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { TemplatesPageClient } from "./templates-page-client"

type Props = {
  params: Promise<{ lang: string }>
  searchParams: Promise<Record<string, string>>
}

export default async function PortalTemplatesPage(props: Props) {
  const auth = await withAuth({ ensureSignedIn: true })
  const platformRole = await getPlatformRoleForUser({
    id: auth.user.id,
    email: auth.user.email,
  })
  const isSuperAdmin = platformRole === "super_admin"

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Templates</h1>
        <p className="text-muted-foreground">
          View and manage your WhatsApp message templates.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Message Templates</CardTitle>
            <CardDescription>Your WhatsApp message templates</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <TemplatesPageClient isSuperAdmin={isSuperAdmin} />
        </CardContent>
      </Card>
    </div>
  )
}
