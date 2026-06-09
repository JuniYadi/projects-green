import { withAuth } from "@workos-inc/authkit-nextjs"
import Link from "next/link"
import { redirect } from "next/navigation"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"

const ONBOARDING_PATH = "/onboarding/organization"

type ConsoleOrganizationPageProps = {
  params: Promise<{
    lang: string
  }>
}

export default async function ConsoleOrganizationPage({
  params,
}: ConsoleOrganizationPageProps) {
  const { lang } = await params
  const locale = resolveLocaleOrDefault(lang)
  const auth = await withAuth({ ensureSignedIn: true })

  if (!auth.organizationId) {
    const onboardingPath = localizePathname({
      pathname: ONBOARDING_PATH,
      locale,
    })
    const consoleOrganizationPath = localizePathname({
      pathname: "/console/organization",
      locale,
    })

    redirect(
      `${onboardingPath}?next=${encodeURIComponent(consoleOrganizationPath)}`
    )
  }

  const cards = [
    {
      title: "Members",
      description: "Manage organization members, roles, promotions, demotions, and removals.",
      href: localizePathname({ pathname: "/console/organization/members", locale }),
    },
    {
      title: "Invitations",
      description: "Invite new users and manage pending organization invitations.",
      href: localizePathname({ pathname: "/console/organization/invitations", locale }),
    },
    {
      title: "Ownership",
      description: "Transfer ownership with the tenant policy guardrails.",
      href: localizePathname({ pathname: "/console/organization/ownership", locale }),
    },
  ]

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Organization Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage members, invitations, and ownership for the active organization.
        </p>
      </header>
      <section className="grid gap-6 md:grid-cols-3">
        {cards.map((card) => (
          <Card key={card.href}>
            <CardHeader>
              <CardTitle className="text-base">{card.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="text-muted-foreground">{card.description}</p>
              <Link
                href={card.href}
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
