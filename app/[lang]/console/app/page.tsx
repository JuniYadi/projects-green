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
  const items = [
    {
      title: "Deploy",
      description: "Configure source, build, and initial release settings.",
      href: localizePathname({ pathname: "/console/app/deploy", locale }),
    },
    {
      title: "Manage",
      description:
        "Control runtime settings, environment, domains, and scaling behavior.",
      href: localizePathname({ pathname: "/console/app/manage", locale }),
    },
  ]

  return (
    <>
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Applications</h1>
        <p className="text-sm text-muted-foreground">
          Manage your full application lifecycle from setup to runtime
          operations.
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
    </>
  )
}
