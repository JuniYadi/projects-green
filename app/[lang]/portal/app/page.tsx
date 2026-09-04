"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import {
  Database,
  Storefront,
  RocketLaunchIcon,
} from "@/components/ui/phosphor-icons"
export default function PortalApplicationsPage() {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">App Hosting Admin</h1>
        <p className="text-sm text-muted-foreground">
          Support and configuration surfaces for the App Hosting MVP. Customer
          deploy and runtime management live in the console.
        </p>
      </header>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-muted/20 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">Cluster Inventory</h2>
              <p className="text-xs text-muted-foreground">
                Manage hosting clusters, regions, and integrations.
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
                View Clusters
              </Link>
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-muted/20 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">Marketplace Templates</h2>
              <p className="text-xs text-muted-foreground">
                Review submissions, manage official and community blueprints.
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
                Manage Templates
              </Link>
            </Button>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-muted/20 p-4 md:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">Deployments Monitor</h2>
              <p className="text-xs text-muted-foreground">
                Monitor active rollouts, inspect build logs, and filter
                deployments per-organization.
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
                View Deployments
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </main>
  )
}
