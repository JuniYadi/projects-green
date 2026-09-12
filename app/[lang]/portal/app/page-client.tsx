"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { getMessages } from "@/lib/i18n/messages"
import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import {
  Database,
  Storefront,
  RocketLaunchIcon,
} from "@/components/ui/phosphor-icons"
export default function PortalApplicationsPage() {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale).console.app.adminOverview

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">{messages.heading}</h1>
        <p className="text-sm text-muted-foreground">{messages.description}</p>
      </header>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-muted/20 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">
                {messages.clustersHeading}
              </h2>
              <p className="text-xs text-muted-foreground">
                {messages.clustersDescription}
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link
                href={localizePathname({
                  pathname: "/portal/app/clusters",
                  locale,
                })}
              >
                <Database size={14} className="mr-1" />
                {messages.clustersAction}
              </Link>
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-muted/20 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">
                {messages.templatesHeading}
              </h2>
              <p className="text-xs text-muted-foreground">
                {messages.templatesDescription}
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link
                href={localizePathname({
                  pathname: "/portal/app/templates",
                  locale,
                })}
              >
                <Storefront size={14} className="mr-1" />
                {messages.templatesAction}
              </Link>
            </Button>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-muted/20 p-4 md:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">
                {messages.deploymentsHeading}
              </h2>
              <p className="text-xs text-muted-foreground">
                {messages.deploymentsDescription}
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link
                href={localizePathname({
                  pathname: "/portal/app/deployments",
                  locale,
                })}
              >
                <RocketLaunchIcon size={14} className="mr-1" />
                {messages.deploymentsAction}
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </main>
  )
}
