import Link from "next/link"

import { DocumentationForm } from "@/modules/docs/ui/documentation-form"

export default function PortalDocumentationsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 p-6 md:p-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Documentation Registry</h1>
        <p className="text-sm text-muted-foreground">
          Create or update UI documentation entries by page path.
        </p>
      </header>

      <section className="rounded-none border border-border p-4 md:p-6">
        <DocumentationForm />
      </section>

      <section className="rounded-none border border-border p-4 md:p-6">
        <h2 className="text-lg font-semibold">Tenant Management</h2>
        <p className="text-sm text-muted-foreground">
          Manage members, invitations, and organization settings from Console.
        </p>
        <p className="pt-2 text-sm">
          <Link
            href="/console/organization"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Open Console Organization Admin
          </Link>
        </p>
      </section>
    </main>
  )
}
