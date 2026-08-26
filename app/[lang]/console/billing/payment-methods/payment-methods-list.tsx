"use client"

import { useState, useCallback, useEffect } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { BankIcon, StarIcon, TrashIcon } from "@phosphor-icons/react"
import {
  getPaymentMethods,
  setDefaultPaymentMethod,
  removePaymentMethod,
} from "@/lib/billing-client"
import type { PaymentMethod } from "@/lib/billing-client"

function maskAccountNumber(number: string): string {
  if (number.length <= 4) return number
  return "*".repeat(number.length - 4) + number.slice(-4)
}

function PaymentMethodsContent({ methods }: { methods: PaymentMethod[] }) {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const t = getMessages(locale).console.billing.paymentMethods
  const [localMethods, setLocalMethods] = useState(methods)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [methodToDelete, setMethodToDelete] = useState<PaymentMethod | null>(
    null
  )
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSetDefault = useCallback(
    async (id: string) => {
      try {
        await setDefaultPaymentMethod(id)
        setLocalMethods((prev: PaymentMethod[]) =>
          prev.map((m: PaymentMethod) => ({ ...m, isDefault: m.id === id }))
        )
      } catch (err) {
        setError(err instanceof Error ? err.message : t.loadError)
      }
    },
    [t.loadError]
  )

  const handleDelete = useCallback(async () => {
    if (!methodToDelete) return

    setIsDeleting(true)
    try {
      await removePaymentMethod(methodToDelete.id)
      setLocalMethods((prev: PaymentMethod[]) =>
        prev.filter((m: PaymentMethod) => m.id !== methodToDelete.id)
      )
      setDeleteDialogOpen(false)
      setMethodToDelete(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : t.loadError)
    } finally {
      setIsDeleting(false)
    }
  }, [methodToDelete, t.loadError])

  const openDeleteDialog = useCallback((method: PaymentMethod) => {
    setMethodToDelete(method)
    setDeleteDialogOpen(true)
  }, [])

  if (localMethods.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center">
            <BankIcon className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-medium">{t.emptyTitle}</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {t.emptyDescription}
            </p>
            <Button asChild className="mt-4">
              <Link href={`/${locale}/console/billing/topup`}>
                {t.addMethod}
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      <div className="space-y-4">
        {localMethods.map((method) => (
          <Card key={method.id}>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                    <BankIcon className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{method.bankName}</span>
                      {method.isDefault && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                          <StarIcon className="h-3 w-3" />
                          {t.defaultBadge}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {maskAccountNumber(method.accountNumber)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!method.isDefault && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSetDefault(method.id)}
                    >
                      {t.setDefaultLabel}
                    </Button>
                  )}
                  {!method.isDefault && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      aria-label={t.removeMethod}
                      onClick={() => openDeleteDialog(method)}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.removeTitle}</DialogTitle>
            <DialogDescription>{t.removeDescription}</DialogDescription>
          </DialogHeader>
          {methodToDelete && (
            <div className="rounded-lg border p-3">
              <p className="font-medium">{methodToDelete.bankName}</p>
              <p className="text-sm text-muted-foreground">
                {maskAccountNumber(methodToDelete.accountNumber)}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              {t.cancel}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? t.removing : t.removeButton}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function PaymentMethodsList() {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const t = getMessages(locale).console.billing.paymentMethods
  const [methods, setMethods] = useState<PaymentMethod[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false

    async function fetchMethods() {
      try {
        const response = await getPaymentMethods()
        if (!cancelled) {
          setMethods(response.accounts)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t.loadError)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void fetchMethods()

    return () => {
      cancelled = true
    }
  }, [t.loadError])
  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4">
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      </div>
    )
  }

  return <PaymentMethodsContent methods={methods} />
}
