import Link from "next/link"

import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { DocumentationForm } from "@/modules/docs/ui/documentation-form"

type PortalDocumentationsPageProps = {
  params: Promise<{
    lang: string
  }>
}

export default async function PortalDocumentationsPage({
  params,
}: PortalDocumentationsPageProps) {
  const { lang } = await params
  const locale = resolveLocaleOrDefault(lang)
  const organizationPath = localizePathname({
    pathname: "/console/organization",
    locale,
  })

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 p-6 md:p-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Documentation Registry</h1>
        <p className="text-sm text-muted-foreground">
          Create or update UI documentation entries by page path.
        </p>
      </header>

      <section className="rounded-lg border border-border p-4 md:p-6">
        <DocumentationForm />
      </section>

      <section className="rounded-lg border border-border p-4 md:p-6">
        <h2 className="text-lg font-semibold">Tenant Management</h2>
        <p className="text-sm text-muted-foreground">
          Manage members, invitations, and organization settings from Console.
        </p>
        <p className="pt-2 text-sm">
          <Link
            href={organizationPath}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Open Console Organization Admin
          </Link>
        </p>
      </section>
    </main>
  )
}
