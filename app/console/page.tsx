import Link from "next/link"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const entryPoints = [
  {
    title: "Tenant Management",
    href: "/console/organization",
    description:
      "Manage roles, invitations, ownership transfers, and organization settings.",
  },
  {
    title: "Documentation Registry",
    href: "/portal/documentations",
    description:
      "Create and maintain contextual UI docs for routes and team workflows.",
  },
  {
    title: "Deployments",
    href: "/console/app/deploy",
    description:
      "Build, configure, and monitor deployment readiness from the console.",
  },
]

export default function ConsolePage() {
  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Console</h1>
        <p className="text-sm text-muted-foreground">
          Choose a workspace entry point to manage your organization and product.
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
