import { withAuth } from "@workos-inc/authkit-nextjs"
import Link from "next/link"

import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { getPlatformRoleForUser } from "@/lib/platform-role"
import { prisma } from "@/lib/prisma"
import { getCachedOrganizations } from "@/lib/workos-directory"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

type WebhooksPageProps = {
  params: Promise<{
    lang: string
  }>
  searchParams: Promise<{
    organizationId?: string
  }>
}

const formatDate = (date: Date | string) => {
  if (typeof date === "string") date = new Date(date)
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

const truncateUrl = (url: string, max = 50) =>
  url.length > max ? url.slice(0, max) + "…" : url

const AUTH_LABELS: Record<string, string> = {
  bearer: "Bearer",
  basic: "Basic",
  "custom-header": "Custom Header",
  none: "None",
}

export default async function PortalWebhooksPage({
  params,
  searchParams,
}: WebhooksPageProps) {
  const { lang } = await params
  const { organizationId } = await searchParams
  const locale = resolveLocaleOrDefault(lang)

  const auth = await withAuth({ ensureSignedIn: true })
  const platformRole = await getPlatformRoleForUser({
    id: auth.user.id,
    email: auth.user.email,
  })

  const isSuperAdmin = platformRole === "super_admin"
  const accessWhere = isSuperAdmin
    ? {}
    : { organizationId: auth.organizationId }
  const selectedOrganizationId =
    organizationId && organizationId !== "all" ? organizationId : undefined
  const filterWhere = selectedOrganizationId
    ? { ...accessWhere, organizationId: selectedOrganizationId }
    : accessWhere

  const [orgRows, webhooks] = await Promise.all([
    prisma.whatsappWebhook.findMany({
      where: accessWhere,
      distinct: ["organizationId"],
      select: { organizationId: true },
      orderBy: { organizationId: "asc" },
    }),
    prisma.whatsappWebhook.findMany({
      where: filterWhere,
      orderBy: { createdAt: "desc" },
      include: {
        whatsappDevice: { select: { phoneNumber: true } },
      },
    }),
  ])

  const organizationIds = orgRows.map((r) => r.organizationId)
  const organizations = await getCachedOrganizations(organizationIds)
  const organizationOptions = organizationIds.map((id) => ({
    id,
    name: organizations.get(id)?.name || id,
  }))

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">WhatsApp Webhooks</h1>
        <p className="text-sm text-muted-foreground">
          Manage outgoing webhook configurations across organizations.
        </p>
      </header>

      <section className="grid gap-6">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">All Webhooks</CardTitle>
                <CardDescription>
                  View and manage outgoing webhook URLs for WhatsApp events.
                </CardDescription>
              </div>
              <form
                action={localizePathname({
                  pathname: "/portal/whatsapp/webhooks",
                  locale,
                })}
                className="flex items-center gap-2"
              >
                <select
                  name="organizationId"
                  defaultValue={selectedOrganizationId ?? "all"}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs"
                  aria-label="Filter by organization"
                >
                  <option value="all">All organizations</option>
                  {organizationOptions.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>
                <Button type="submit" size="sm" variant="outline">
                  Filter
                </Button>
              </form>
            </div>
          </CardHeader>
          <CardContent>
            {webhooks.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No webhooks configured yet.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Organization</TableHead>
                      <TableHead>Phone Number</TableHead>
                      <TableHead>Webhook URL</TableHead>
                      <TableHead>Auth</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {webhooks.map((wh) => (
                      <TableRow key={wh.id}>
                        <TableCell className="text-sm">
                          {organizations.get(wh.organizationId)?.name ??
                            wh.organizationId}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {wh.whatsappDevice?.phoneNumber ?? "—"}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate font-mono text-sm">
                          {truncateUrl(wh.webhookUrl)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {AUTH_LABELS[wh.authType ?? ""] ??
                              wh.authType ??
                              "None"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={wh.active ? "success" : "secondary"}>
                            {wh.active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(wh.createdAt)}
                        </TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/portal/whatsapp/webhooks/${wh.id}`}>
                              Detail
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  )
}
