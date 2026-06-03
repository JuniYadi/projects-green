import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { ArrowLeftIcon } from "@/components/ui/phosphor-icons"
import Link from "next/link"
import { MembersTable } from "./members-table"

export default async function OrganizationDetailPage({
  params,
}: Readonly<{
  params: Promise<{ id: string }>
}>) {
  const { id } = await params

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
              <BreadcrumbLink href="/portal/admin/organizations">Organizations</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{id}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="mt-2 flex items-center gap-4">
          <Link href="/portal/admin/organizations">
            <Button variant="ghost" size="icon">
              <ArrowLeftIcon className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Organization Details</h1>
            <p className="text-sm text-muted-foreground font-mono">{id}</p>
          </div>
        </div>
      </div>
      <MembersTable organizationId={id} />
    </main>
  )
}
