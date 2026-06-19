import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeftIcon } from "@/components/ui/phosphor-icons"
import { VoucherDetail } from "./voucher-detail"

export default async function VoucherDetailPage({
  params,
}: Readonly<{
  params: Promise<{ id: string }>
}>) {
  const { id } = await params

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <div className="flex items-center gap-4">
          <Link href="/portal/billing/voucher">
            <Button variant="ghost" size="icon">
              <ArrowLeftIcon className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Voucher Details</h1>
            <p className="font-mono text-sm text-muted-foreground">{id}</p>
          </div>
        </div>
      </header>
      <VoucherDetail voucherId={id} />
    </main>
  )
}
