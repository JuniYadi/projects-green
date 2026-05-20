import Link from "next/link"

import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type ConsolePageProps = {
  params: Promise<{
    lang: string
  }>
}

export default async function ConsolePage({ params }: ConsolePageProps) {
  const { lang } = await params
  const locale = resolveLocaleOrDefault(lang)
  const entryPoints = [
    {
      title: "Tenant Management",
      href: localizePathname({ pathname: "/console/organization", locale }),
      description:
        "Manage roles, invitations, ownership transfers, and organization settings.",
    },
    {
      title: "Documentation Registry",
      href: localizePathname({ pathname: "/portal/documentations", locale }),
      description:
        "Create and maintain contextual UI docs for routes and team workflows.",
    },
    {
      title: "Applications",
      href: localizePathname({ pathname: "/console/app", locale }),
      description:
        "Deploy, manage, and monitor application lifecycle workflows.",
    },
  ]

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Console</h1>
        <p className="text-sm text-muted-foreground">
          Choose a workspace entry point to manage your organization and
          product.
        </p>
      </header>

      <section className="grid gap-6 md:grid-cols-3">
        {entryPoints.map((entry) => (
          <Card key={entry.title}>
            <CardHeader>
              <CardTitle className="text-base">{entry.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="text-muted-foreground">{entry.description}</p>
              <Link
                href={entry.href}
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Open
              </Link>
            </CardContent>
          </Card>
        ))}
      </section>
    </main>
  )
}
