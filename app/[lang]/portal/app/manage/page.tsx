import Link from "next/link"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"

type PortalManagePageProps = {
  params: Promise<{
    lang: string
  }>
}

/**
 * PGREEN-073 — Portal scope guard.
 *
 * Runtime app management (status, scaling, domains, env, logs) is a
 * customer-facing CONSOLE workflow. The /portal surface for the App Hosting
 * MVP is intentionally limited to admin CRUD/support (detector governance),
 * so this page makes the boundary explicit instead of duplicating the
 * console manage cockpit with simulated data.
 */
export default async function PortalManagePage({
  params,
}: PortalManagePageProps) {
  const { lang } = await params
  const locale = resolveLocaleOrDefault(lang)

  const detectorHref = localizePathname({
    pathname: "/portal/app/detector",
    locale,
  })
  const appHref = localizePathname({ pathname: "/portal/app", locale })

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">
          Runtime management lives in console
        </h1>
        <p className="text-sm text-muted-foreground">
          Operating deployed apps is a customer-facing workflow and is not part
          of the portal admin scope for the App Hosting MVP.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">What admins manage here</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            The portal is bounded to admin CRUD and support. For the App Hosting
            MVP that means detector governance — detection rules, runtime
            mappings, and AI recommendations.
          </p>
          <Link
            href={detectorHref}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Open Detector Control Center
          </Link>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Looking for app runtime status, scaling, domains, or logs? Those live in
        the console.{" "}
        <Link
          href={appHref}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Back to App Hosting admin
        </Link>
      </p>
    </main>
  )
}
