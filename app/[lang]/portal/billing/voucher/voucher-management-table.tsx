"use client"

import { useCallback, useEffect, useState } from "react"
import { eden } from "@/lib/eden"
import { useRouter } from "next/navigation"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  MagnifyingGlassIcon,
  PlusIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  CopySimpleIcon,
} from "@phosphor-icons/react"
import type { VoucherStatus } from "@prisma/client"

type VoucherItem = {
  id: string
  code: string
  prefix: string | null
  status: VoucherStatus
  maxClaims: number
  claimedCount: number
  expiresAt: string
  amount: string
  currency: string
  targetWorkosUserId: string | null
  targetOrganizationId: string | null
  createdByWorkosUserId: string
  createdAt: string
}


const STATUS_COLORS: Record<VoucherStatus, string> = {
  ACTIVE:
    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  EXPIRED:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  DEPLETED:
    "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  DISABLED: "bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-400",
}

const PAGE_SIZE = 20

export function VoucherManagementTable() {
  const router = useRouter()
  const [vouchers, setVouchers] = useState<VoucherItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [offset, setOffset] = useState(0)
  const [total, setTotal] = useState(0)

  // Create dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [createForm, setCreateForm] = useState({
    prefix: "",
    maxClaims: "1",
    expiresAt: "",
    amount: "",
    currency: "IDR",
    targetWorkosUserId: "",
    targetOrganizationId: "",
  })
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const searchParams = new URLSearchParams()
      searchParams.set("limit", String(PAGE_SIZE))
      searchParams.set("offset", String(offset))
      if (search) searchParams.set("prefix", search)

      const { data } = await eden.api.vouchers.portal.get({
        $query: Object.fromEntries(searchParams.entries()),
      })

      if (!data) {
        setError("Failed to load vouchers")
        return
      }
      if (!data.ok) {
        setError(data.message || "Failed to load vouchers")
        return
      }
      setVouchers(data.data as never)
      setTotal(data.total as never)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred"
      )
    } finally {
      setIsLoading(false)
    }
  }, [offset, search])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchData()
  }, [fetchData])

  function handleSearch(value: string) {
    setSearch(value)
    setOffset(0)
  }

  function copyCode(code: string, e: React.MouseEvent) {
    e.stopPropagation()
    navigator.clipboard.writeText(code).then(() => {
      // brief visual feedback could be added later
    })
  }

  function handlePrevPage() {
    setOffset(Math.max(0, offset - PAGE_SIZE))
  }

  function handleNextPage() {
    setOffset(offset + PAGE_SIZE)
  }

  async function handleCreate() {
    setIsCreating(true)
    setCreateError(null)

    try {
      const payload: Record<string, unknown> = {
        maxClaims: parseInt(createForm.maxClaims, 10) || 1,
        expiresAt: new Date(createForm.expiresAt).toISOString(),
        amount: parseFloat(createForm.amount) || 0,
        currency: createForm.currency,
      }

      if (createForm.prefix.trim()) {
        payload.prefix = createForm.prefix.toUpperCase().trim()
      }
      if (createForm.targetWorkosUserId.trim()) {
        payload.targetWorkosUserId = createForm.targetWorkosUserId.trim()
      }
      if (createForm.targetOrganizationId.trim()) {
        payload.targetOrganizationId = createForm.targetOrganizationId.trim()
      }

      const { data } = await eden.api.vouchers.portal.post(payload)

      if (data?.ok) {
        setDialogOpen(false)
        setCreateForm({
          prefix: "",
          maxClaims: "1",
          expiresAt: "",
          amount: "",
          currency: "IDR",
          targetWorkosUserId: "",
          targetOrganizationId: "",
        })
        // Reload the list from first page
        setOffset(0)
        void fetchData()
      } else {
        setCreateError(data?.message || "Failed to create voucher")
      }
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : "An unexpected error occurred"
      )
    } finally {
      setIsCreating(false)
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1

  if (isLoading && vouchers.length === 0) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="relative max-w-sm flex-1">
          <MagnifyingGlassIcon className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search vouchers by prefix..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusIcon className="mr-2 h-4 w-4" />
              Create Voucher
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Create Voucher</DialogTitle>
              <DialogDescription>
                Create a new discount voucher code. The voucher will be
                available for users to redeem.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="prefix" className="text-right">
                  Prefix
                </Label>
                <Input
                  id="prefix"
                  value={createForm.prefix}
                  onChange={(e) =>
                    setCreateForm({
                      ...createForm,
                      prefix: e.target.value.toUpperCase(),
                    })
                  }
                  placeholder="e.g. WELCOME"
                  className="col-span-3 uppercase"
                />
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="amount" className="text-right">
                  Amount *
                </Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={createForm.amount}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, amount: e.target.value })
                  }
                  placeholder="e.g. 50000"
                  className="col-span-3"
                />
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="currency" className="text-right">
                  Currency
                </Label>
                <Select
                  value={createForm.currency}
                  onValueChange={(val) =>
                    setCreateForm({ ...createForm, currency: val })
                  }
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IDR">IDR - Indonesian Rupiah</SelectItem>
                    <SelectItem value="USD">USD - US Dollar</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="maxClaims" className="text-right">
                  Max Claims *
                </Label>
                <Input
                  id="maxClaims"
                  type="number"
                  min="1"
                  value={createForm.maxClaims}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, maxClaims: e.target.value })
                  }
                  className="col-span-3"
                />
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="expiresAt" className="text-right">
                  Expires At *
                </Label>
                <Input
                  id="expiresAt"
                  type="datetime-local"
                  value={createForm.expiresAt}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, expiresAt: e.target.value })
                  }
                  className="col-span-3"
                />
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="targetUserId" className="text-right">
                  Target User ID
                </Label>
                <Input
                  id="targetUserId"
                  value={createForm.targetWorkosUserId}
                  onChange={(e) =>
                    setCreateForm({
                      ...createForm,
                      targetWorkosUserId: e.target.value,
                    })
                  }
                  placeholder="Leave empty for anyone"
                  className="col-span-3"
                />
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="targetOrgId" className="text-right">
                  Target Org ID
                </Label>
                <Input
                  id="targetOrgId"
                  value={createForm.targetOrganizationId}
                  onChange={(e) =>
                    setCreateForm({
                      ...createForm,
                      targetOrganizationId: e.target.value,
                    })
                  }
                  placeholder="Leave empty for any org"
                  className="col-span-3"
                />
              </div>
            </div>

            {createError && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                {createError}
              </div>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={isCreating}
              >
                Cancel
              </Button>
              <Button
                onClick={() => void handleCreate()}
                disabled={
                  isCreating || !createForm.amount || !createForm.expiresAt
                }
              >
                {isCreating ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Claims</TableHead>
              <TableHead>Expires At</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vouchers.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-24 text-center text-muted-foreground"
                >
                  No vouchers found
                </TableCell>
              </TableRow>
            ) : (
              vouchers.map((voucher) => (
                <TableRow
                  key={voucher.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() =>
                    router.push(`/portal/billing/voucher/${voucher.id}`)
                  }
                >
                  <TableCell className="font-mono text-xs font-medium">
                    <span className="flex items-center gap-1.5">
                      {voucher.code}
                      <button
                        onClick={(e) => copyCode(voucher.code, e)}
                        className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                        title="Copy to clipboard"
                      >
                        <CopySimpleIcon className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={STATUS_COLORS[voucher.status] ?? ""}
                    >
                      {voucher.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {voucher.currency} {Number(voucher.amount).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    {voucher.claimedCount}/{voucher.maxClaims}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(voucher.expiresAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {voucher.targetWorkosUserId
                      ? "Specific user"
                      : voucher.targetOrganizationId
                        ? "Specific org"
                        : "Anyone"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(voucher.createdAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {total > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages} ({total} total)
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrevPage}
              disabled={offset === 0 || isLoading}
            >
              <ArrowLeftIcon className="mr-2 h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNextPage}
              disabled={offset + PAGE_SIZE >= total || isLoading}
            >
              Next
              <ArrowRightIcon className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
