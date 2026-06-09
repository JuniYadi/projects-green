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
      <header className="space-y-1">
        <div className="flex items-center gap-4">
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
      </header>
      <MembersTable organizationId={id} />
    </main>
  )
}
