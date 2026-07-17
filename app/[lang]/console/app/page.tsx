import Link from "next/link"

import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { getMessages } from "@/lib/i18n/messages"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

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
  const messages = getMessages(locale)
  const items = [
    {
      title: messages.console.app.overview.deploy,
      description: messages.console.app.overview.deployDescription,
      href: localizePathname({ pathname: "/console/app/deploy", locale }),
    },
    {
      title: messages.console.app.overview.manage,
      description: messages.console.app.overview.manageDescription,
      href: localizePathname({ pathname: "/console/app/manage", locale }),
    },
    {
      title: messages.console.app.overview.credentials,
      description: messages.console.app.overview.credentialsDescription,
      href: localizePathname({ pathname: "/console/app/credentials", locale }),
    },
  ]

  return (
    <>
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">{messages.console.app.overview.heading}</h1>
        <p className="text-sm text-muted-foreground">
          {messages.console.app.overview.description}
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
