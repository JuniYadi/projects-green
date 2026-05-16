import { DocumentationForm } from "@/modules/docs/ui/documentation-form"
import { TenantMemberManagement } from "@/modules/tenants/ui/tenant-member-management"
import { withAuth } from "@workos-inc/authkit-nextjs"

export default async function PortalDocumentationsPage() {
  const auth = await withAuth()
  const organizationId = auth.organizationId ?? null

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 p-6 md:p-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Documentation Input</h1>
        <p className="text-sm text-muted-foreground">
          Create or update UI documentation entries by page path.
        </p>
      </header>

      <section className="rounded-none border border-border p-4 md:p-6">
        <DocumentationForm />
      </section>

      {organizationId ? (
        <TenantMemberManagement organizationId={organizationId} />
      ) : (
        <section className="rounded-none border border-border p-4 md:p-6">
          <h2 className="text-lg font-semibold">Tenant Member Management</h2>
          <p className="text-sm text-muted-foreground">
            Select or join an organization first to manage members.
          </p>
        </section>
      )}
    </main>
  )
}
