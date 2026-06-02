import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { OrganizationsTable } from "./organizations-table"

export default async function OrganizationsPage() {
  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <div>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/portal/admin">Admin</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Organizations</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <h1 className="mt-2 text-2xl font-bold">Organizations</h1>
        <p className="text-sm text-muted-foreground">
          Manage all organizations on the platform
        </p>
      </div>
      <OrganizationsTable />
    </main>
  )
}
