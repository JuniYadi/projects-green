import Link from "next/link"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"

type ApplicationsPageProps = {
  params: Promise<{
    lang: string
  }>
}

export default async function ApplicationsPage({
  params,
}: ApplicationsPageProps) {
  const { lang } = await params
  const locale = resolveLocaleOrDefault(lang)

  // PGREEN-073 — /portal App Hosting is bounded to admin CRUD/support only.
  // It is NOT a runtime operations cockpit; customer deploy/manage lives in
  // /console. The supported admin-managed surface for the MVP is detector
  // governance (rules, runtime mappings, AI recommendations).
  const items = [
    {
      title: "Detector Control Center",
      description:
        "Govern detection rules, runtime mappings, and review AI recommendations.",
      href: localizePathname({ pathname: "/portal/app/detector", locale }),
    },
  ]

  return (
    <>
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">App Hosting Admin</h1>
        <p className="text-sm text-muted-foreground">
          Support and configuration surfaces for the App Hosting MVP. Customer
          deploy and runtime management live in the console.
        </p>
      </header>

      <section className="grid gap-6 md:grid-cols-3">
        {items.map((item) => (
          <Card key={item.title}>
            <CardHeader>
              <CardTitle className="text-base">{item.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="text-muted-foreground">{item.description}</p>
              <Link
                href={item.href}
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Open
              </Link>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="rounded-xl border border-dashed border-border bg-muted/10 p-4 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Out of portal scope</p>
        <p className="mt-1">
          Deploying apps and runtime operations (status, scaling, domains,
          logs) are customer-facing console workflows and are intentionally not
          exposed here.
        </p>
      </section>
    </>
  )
}
