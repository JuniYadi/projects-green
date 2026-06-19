import Link from "next/link"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"

type DeployPageProps = {
  params: Promise<{
    lang: string
  }>
}

export default async function DeployPage({ params }: DeployPageProps) {
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
        <h1 className="text-2xl font-semibold">Deploy lives in console</h1>
        <p className="text-sm text-muted-foreground">
          Deploying applications is a customer-facing workflow and is not part
          of the portal admin scope for the App Hosting MVP.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">What admins manage here</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Portal App Hosting is limited to admin CRUD and support surfaces.
            Use Detector Control Center to govern detection rules, runtime
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
        Looking for deployment workflows? Those live in the console.{" "}
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
