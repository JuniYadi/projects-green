"use client"

import { getMessages } from "@/lib/i18n/messages"
import { eden } from "@/lib/eden"
import Link from "next/link"
import { useParams } from "next/navigation"
import { type ColumnDef } from "@tanstack/react-table"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { DataTable } from "@/components/data-table"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  XCircleIcon,
  Spinner,
} from "@phosphor-icons/react"

type ClaimRecord = {
  id: string
  voucherCode: string
  amount: string
  currency: string
  claimedAt: string
}

export default function VouchersPage() {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)
  const t = messages.console.billing.vouchers
  const [code, setCode] = useState("")
  const [isRedeeming, setIsRedeeming] = useState(false)
  const [redeemResult, setRedeemResult] = useState<{
    type: "success" | "error"
    message: string
  } | null>(null)
  const [claims, setClaims] = useState<ClaimRecord[]>([])
  const [isLoadingClaims, setIsLoadingClaims] = useState(true)

  useEffect(() => {
    const abortController = new AbortController()

    async function loadClaims() {
      try {
        const { data } = await eden.api.vouchers.claims.get({
          $fetch: { signal: abortController.signal },
        })
        if (!data?.ok) return
        setClaims(
          data.data.map(
            (item: {
              id: string
              voucher: { code: string; amount: string; currency: string }
              claimedAt: string
            }) => ({
              id: item.id,
              voucherCode: item.voucher.code,
              amount: item.voucher.amount,
              currency: item.voucher.currency,
              claimedAt: item.claimedAt,
            })
          )
        )
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return
        // Silently fail — claims table will be empty
      } finally {
        setIsLoadingClaims(false)
      }
    }

    void loadClaims()
    return () => abortController.abort()
  }, [])

  async function handleRedeem() {
    const trimmedCode = code.trim().toUpperCase()
    if (!trimmedCode) return

    setIsRedeeming(true)
    setRedeemResult(null)

    try {
      const redeemParams: Record<string, unknown> = { code: trimmedCode }
      const { data } = await eden.api.vouchers.redeem.post(
        redeemParams as never
      )

      if (!data?.ok) {
        setRedeemResult({
          type: "error",
          message: data?.message || t.failedRedeem,
        })
        return
      }
      setRedeemResult({
        type: "success",
        message: t.redemptionSuccess.replace(
          "{amount}",
          `${data.data.currency} ${Number(data.data.amount).toLocaleString()}`
        ),
      })
      setCode("")

      // Reload claims to include the new one
      const { data: claimsData } = await eden.api.vouchers.claims.get()
      if (claimsData?.ok) {
        setClaims(
          claimsData.data.map(
            (item: {
              id: string
              voucher: { code: string; amount: string; currency: string }
              claimedAt: string
            }) => ({
              id: item.id,
              voucherCode: item.voucher.code,
              amount: item.voucher.amount,
              currency: item.voucher.currency,
              claimedAt: item.claimedAt,
            })
          )
        )
      }
    } catch {
      setRedeemResult({
        type: "error",
        message: t.unexpectedError,
      })
    } finally {
      setIsRedeeming(false)
    }
  }

  function dismissResult() {
    setRedeemResult(null)
  }

  const columns: ColumnDef<ClaimRecord>[] = [
    {
      accessorKey: "voucherCode",
      header: t.codeLabel,
    },
    {
      accessorKey: "amount",
      header: t.tableAmount,
      cell: ({ row }) => {
        const amount = row.getValue("amount") as string
        const currency = row.original.currency
        return `${currency} ${Number(amount).toLocaleString()}`
      },
    },
    {
      accessorKey: "claimedAt",
      header: t.claimedAt,
      cell: ({ row }) => {
        const date = row.getValue("claimedAt") as string
        return new Date(date).toLocaleDateString(
          locale === "id" ? "id-ID" : "en-US",
          {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }
        )
      },
    },
  ]

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/${locale}/console/billing`}>
              <ArrowLeftIcon className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold">{t.heading}</h1>
        </div>
        <p className="text-sm text-muted-foreground">{t.description}</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.codeLabel}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              value={code}
              onChange={(e) => {
                setCode(e.target.value)
                if (redeemResult) dismissResult()
              }}
              placeholder={t.codePlaceholder}
              className="uppercase sm:max-w-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isRedeeming && code.trim()) {
                  void handleRedeem()
                }
              }}
            />
            <Button
              onClick={() => void handleRedeem()}
              disabled={isRedeeming || !code.trim()}
            >
              {isRedeeming ? (
                <>
                  <Spinner className="mr-2 h-4 w-4 animate-spin" />
                  {t.redeeming}
                </>
              ) : (
                t.redeem
              )}
            </Button>
          </div>

          {redeemResult && (
            <div
              className={`flex items-start gap-3 rounded-lg border p-4 ${
                redeemResult.type === "success"
                  ? "border-green-500/20 bg-green-500/10"
                  : "border-red-500/20 bg-red-500/10"
              }`}
            >
              {redeemResult.type === "success" ? (
                <CheckCircleIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600 dark:text-green-400" />
              ) : (
                <XCircleIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-400" />
              )}
              <div className="flex-1">
                <p
                  className={`text-sm font-medium ${
                    redeemResult.type === "success"
                      ? "text-green-700 dark:text-green-300"
                      : "text-red-700 dark:text-red-300"
                  }`}
                >
                  {redeemResult.message}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                aria-label={t.dismissResult}
                onClick={dismissResult}
              >
                <XCircleIcon className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.historyHeading}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingClaims ? (
            <Skeleton className="h-32" />
          ) : (
            <DataTable
              tableId="console-billing-vouchers"
              columns={columns}
              data={claims}
              emptyMessage={t.emptyHistory}
              searchableColumns={["voucherCode"]}
              searchPlaceholder={t.searchPlaceholder}
            />
          )}
        </CardContent>
      </Card>
    </main>
  )
}
