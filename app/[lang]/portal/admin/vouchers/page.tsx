import { VoucherManagementTable } from "./voucher-management-table"

export default async function AdminVouchersPage() {
  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Vouchers</h1>
        <p className="text-sm text-muted-foreground">
          Create and manage discount vouchers.
        </p>
      </header>
      <VoucherManagementTable />
    </main>
  )
}
