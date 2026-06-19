import Link from "next/link"

import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default async function PortalPage({
  params,
}: Readonly<{
  params: Promise<{
    lang: string
  }>
}>) {
  const { lang } = await params
  const locale = resolveLocaleOrDefault(lang)

  const entryPoints = [
    {
      title: "Documentation Registry",
      href: localizePathname({ pathname: "/portal/documentations", locale }),
      description:
        "Create and maintain contextual UI docs for routes and team workflows.",
    },
    {
      title: "Invoices",
      href: localizePathname({ pathname: "/portal/invoices", locale }),
      description:
        "Review billing records, download receipts, and manage invoice status.",
    },
    {
      title: "Support Tickets",
      href: localizePathname({ pathname: "/portal/support-tickets", locale }),
      description:
        "Manage, prioritize, and reply to all support tickets across organizations.",
    },
  ]

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Portal</h1>
        <p className="text-sm text-muted-foreground">
          Choose a workspace entry point to manage documentation, billing, or
          support tickets.
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
