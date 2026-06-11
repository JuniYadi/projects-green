"use client"

import { useState, useEffect, useRef, useCallback, Suspense, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { ArrowLeftIcon, CheckCircleIcon, UploadIcon, SpinnerGap, TrashSimple } from "@phosphor-icons/react"

interface BankAccount {
  id: string
  bankCode: string
  bankName: string
  accountNumber: string
  accountName: string
  isActive: boolean
  isDefault: boolean
}

type FormState = "idle" | "submitting" | "success" | "error"

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(value)
}

function getDefaultPaymentDateTime(): string {
  const now = new Date()
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
  return now.toISOString().slice(0, 16)
}

function ConfirmationPageContent() {
  const searchParams = useSearchParams()

  const invoiceId = searchParams.get("invoiceId") || ""
  const amountParam = searchParams.get("amount") || ""
  const urlAmount = amountParam ? Number.parseInt(amountParam, 10) : 0

  const [formState, setFormState] = useState<FormState>("idle")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true)

  // Invoice amount — prefer URL param, fallback to API fetch
  const [invoiceAmount, setInvoiceAmount] = useState(urlAmount)
  const [isLoadingInvoice, setIsLoadingInvoice] = useState(!urlAmount && !!invoiceId)

  // Screenshot upload
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null)
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null)
  const [isUploadingScreenshot, setIsUploadingScreenshot] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Form fields
  const [bankAccountId, setBankAccountId] = useState<string>("")
  const [senderBankName, setSenderBankName] = useState<string>("")
  const [senderName, setSenderName] = useState<string>("")
  const [senderAccount, setSenderAccount] = useState<string>("")
  const [notes, setNotes] = useState<string>("")
  const [initialPaymentDateTime] = useState(getDefaultPaymentDateTime)

  // ── Fetch invoice amount when not in URL params ──
  useEffect(() => {
    if (urlAmount > 0 || !invoiceId) return

    let cancelled = false

    async function fetchInvoice() {
      try {
        const response = await fetch(`/api/payments/topup/invoice/${invoiceId}`)
        const data = await response.json()
        if (data.ok && !cancelled) {
          const totalAmount = data.invoice?.totalAmount
          const parsed =
            typeof totalAmount === "number"
              ? totalAmount
              : Number.parseFloat(String(totalAmount))
          if (!Number.isNaN(parsed)) {
            setInvoiceAmount(parsed)
          }
        }
      } catch {
        // Silently fail — amount stays 0, form won't be submittable
      } finally {
        if (!cancelled) setIsLoadingInvoice(false)
      }
    }

    void fetchInvoice()

    return () => {
      cancelled = true
    }
  }, [invoiceId, urlAmount])

  // ── Fetch bank accounts ──
  useEffect(() => {
    let cancelled = false

    async function fetchBankAccounts() {
      try {
        const response = await fetch("/api/payments/topup/bank-accounts")
        const data = await response.json()
        if (data.ok && !cancelled) {
          setBankAccounts(data.data || [])
          if (data.data?.length > 0) {
            const preselected = searchParams.get("bankAccountId")
            if (
              preselected &&
              data.data.some((b: BankAccount) => b.id === preselected)
            ) {
              setBankAccountId(preselected)
            } else {
              const defaultAccount = data.data.find(
                (b: BankAccount) => b.isDefault,
              )
              setBankAccountId(defaultAccount?.id || data.data[0].id)
            }
          }
        }
      } catch {
        // Silently fail
      } finally {
        if (!cancelled) setIsLoadingAccounts(false)
      }
    }

    void fetchBankAccounts()

    return () => {
      cancelled = true
    }
  }, [searchParams])

  const displayAmount = urlAmount > 0 ? urlAmount : invoiceAmount
  const isValid = bankAccountId && initialPaymentDateTime && displayAmount > 0

  // ── Screenshot upload handler ──
  const uploadScreenshot = useCallback(async (file: File) => {
    const allowedTypes = ["image/png", "image/jpeg"]
    if (!allowedTypes.includes(file.type)) {
      setErrorMessage("Only PNG and JPG files are allowed")
      return
    }

    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      setErrorMessage("File size must be under 10MB")
      return
    }

    setIsUploadingScreenshot(true)
    setErrorMessage(null)

    try {
      const formData = new FormData()
      formData.append("file", file)

      const response = await fetch("/api/payments/upload-screenshot", {
        method: "POST",
        body: formData,
      })

      const result = await response.json()
      if (!result.ok) throw new Error(result.message || "Upload failed")

      setScreenshotUrl(result.url)
      setScreenshotPreview(URL.createObjectURL(file))
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to upload screenshot",
      )
    } finally {
      setIsUploadingScreenshot(false)
    }
  }, [])

  const removeScreenshot = useCallback(() => {
    if (screenshotPreview) URL.revokeObjectURL(screenshotPreview)
    setScreenshotUrl(null)
    setScreenshotPreview(null)
  }, [screenshotPreview])

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) void uploadScreenshot(file)
      // Reset so re-selecting the same file triggers onChange
      e.target.value = ""
    },
    [uploadScreenshot],
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(false)
      const file = e.dataTransfer.files?.[0]
      if (file) void uploadScreenshot(file)
    },
    [uploadScreenshot],
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValid) return

    setFormState("submitting")
    setErrorMessage(null)

    try {
      const response = await fetch(
        `/api/payments/topup/confirm/${invoiceId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bankAccountId,
            amount: displayAmount,
            paymentDateTime: new Date(
              initialPaymentDateTime,
            ).toISOString(),
            senderBankName: senderBankName || undefined,
            senderName: senderName || undefined,
            senderAccount: senderAccount || undefined,
            screenshotUrl: screenshotUrl || undefined,
            notes: notes || undefined,
          }),
        },
      )

      const result = await response.json()
      if (!response.ok || !result.ok) {
        throw new Error(
          result.message || "Confirmation failed. Please try again.",
        )
      }

      setFormState("success")
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Confirmation failed. Please try again.",
      )
      setFormState("error")
    }
  }

  const selectedBank = useMemo(
    () => bankAccounts.find((b) => b.id === bankAccountId),
    [bankAccounts, bankAccountId],
  )

  // ── Success state ──
  if (formState === "success") {
    return (
      <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
        <header className="space-y-1">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/console/billing">
                <ArrowLeftIcon className="h-4 w-4" />
              </Link>
            </Button>
            <h1 className="text-2xl font-semibold">Payment Confirmed</h1>
          </div>
        </header>

        <Card>
          <CardContent className="flex flex-col items-center p-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <CheckCircleIcon className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="mt-4 text-xl font-semibold">
              Payment Confirmation Submitted
            </h2>
            <p className="mt-2 text-muted-foreground">
              Your payment confirmation has been submitted successfully. We will
              verify your payment and update your balance shortly.
            </p>

            <div className="mt-6 w-full max-w-sm rounded-lg border bg-muted/30 p-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-medium">
                    {formatCurrency(displayAmount)}
                  </span>
                </div>
                {selectedBank && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Destination</span>
                    <span className="font-medium">
                      {selectedBank.bankName}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <Button variant="outline" asChild>
                <Link href="/console/billing">Back to Billing</Link>
              </Button>
              <Button asChild>
                <Link href="/console/billing/invoices">View Invoices</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    )
  }

  // ── Loading state ──
  if (isLoadingAccounts || isLoadingInvoice) {
    return (
      <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
        <header className="space-y-1">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </header>
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </CardContent>
        </Card>
      </main>
    )
  }

  // ── Form state ──
  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/console/billing/topup">
              <ArrowLeftIcon className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold">Confirm Payment</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Submit your manual bank transfer details for verification.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Transfer Details</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Amount Display */}
                <div className="rounded-lg border bg-muted/30 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Amount to Confirm
                    </span>
                    <span className="text-xl font-semibold">
                      {formatCurrency(displayAmount)}
                    </span>
                  </div>
                  {invoiceId && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      Invoice: {invoiceId}
                    </div>
                  )}
                </div>

                {/* Bank Account Selection */}
                <Field>
                  <FieldLabel>Destination Bank Account</FieldLabel>
                  {bankAccounts.length > 0 ? (
                    <div className="space-y-2">
                      {bankAccounts.map((account) => {
                        const isSelected = account.id === bankAccountId
                        return (
                          <button
                            key={account.id}
                            type="button"
                            onClick={() => setBankAccountId(account.id)}
                            className={`w-full rounded-lg border p-4 text-left text-sm transition-colors ${
                              isSelected
                                ? "border-primary bg-primary/5 ring-1 ring-primary"
                                : "border-border hover:border-muted-foreground/50"
                            }`}
                          >
                            <div className="font-medium">{account.bankName}</div>
                            <div className="mt-0.5 text-muted-foreground">
                              {account.accountNumber}
                            </div>
                            <div className="text-muted-foreground">
                              a.n. {account.accountName}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  ) : (
                    <Input type="text" value="No bank accounts available" disabled />
                  )}
                </Field>

                {/* Payment DateTime */}
                <Field>
                  <FieldLabel>Transfer Date & Time</FieldLabel>
                  <Input
                    type="datetime-local"
                    value={initialPaymentDateTime}
                    disabled={formState === "submitting"}
                  />
                </Field>

                {/* Sender Details (Optional) */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium">
                    Sender Details (Optional)
                  </h3>

                  <Field>
                    <FieldLabel>Sender Bank Name</FieldLabel>
                    <Input
                      type="text"
                      value={senderBankName}
                      onChange={(e) => setSenderBankName(e.target.value)}
                      placeholder="e.g., Bank BCA"
                      disabled={formState === "submitting"}
                    />
                  </Field>

                  <Field>
                    <FieldLabel>Sender Name</FieldLabel>
                    <Input
                      type="text"
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                      placeholder="Account holder name"
                      disabled={formState === "submitting"}
                    />
                  </Field>

                  <Field>
                    <FieldLabel>Sender Account Number</FieldLabel>
                    <Input
                      type="text"
                      value={senderAccount}
                      onChange={(e) => setSenderAccount(e.target.value)}
                      placeholder="Sender account number"
                      disabled={formState === "submitting"}
                    />
                  </Field>
                </div>

                {/* Screenshot Upload (Optional) */}
                <Field>
                  <FieldLabel>Payment Proof (Optional)</FieldLabel>

                  {screenshotPreview ? (
                    <div className="relative overflow-hidden rounded-lg border">
                      {/* eslint-disable-next-line @next/next/no-img-element -- blob URL, cannot use next/image */}
                      <img
                        src={screenshotPreview}
                        alt="Payment proof preview"
                        className="max-h-48 w-full object-contain bg-muted/20"
                      />
                      <div className="flex items-center justify-between border-t bg-muted/30 px-3 py-2">
                        <span className="text-xs text-muted-foreground">
                          Proof uploaded
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={removeScreenshot}
                          disabled={isUploadingScreenshot}
                        >
                          <TrashSimple className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`relative rounded-md border-2 border-dashed p-6 text-center transition-colors ${
                        isDragOver
                          ? "border-primary bg-primary/5"
                          : "border-muted-foreground/25 hover:border-muted-foreground/50"
                      }`}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ")
                          fileInputRef.current?.click()
                      }}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg"
                        className="hidden"
                        onChange={handleFileChange}
                      />

                      {isUploadingScreenshot ? (
                        <>
                          <SpinnerGap className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
                          <p className="mt-2 text-sm text-muted-foreground">
                            Uploading...
                          </p>
                        </>
                      ) : (
                        <>
                          <UploadIcon className="mx-auto h-8 w-8 text-muted-foreground" />
                          <p className="mt-2 text-sm text-muted-foreground">
                            Drag and drop or click to upload
                          </p>
                          <p className="text-xs text-muted-foreground">
                            PNG, JPG up to 10MB
                          </p>
                        </>
                      )}
                    </div>
                  )}
                </Field>

                {/* Notes */}
                <Field>
                  <FieldLabel>Notes (Optional)</FieldLabel>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any additional information about the payment"
                    rows={3}
                    disabled={formState === "submitting"}
                  />
                </Field>

                {formState === "error" && errorMessage && (
                  <div className="rounded-md border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">
                    {errorMessage}
                  </div>
                )}

                <div className="flex gap-3">
                  <Button type="button" variant="outline" asChild>
                    <Link href="/console/billing/topup">Cancel</Link>
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={!isValid || formState === "submitting"}
                  >
                    {formState === "submitting"
                      ? "Submitting..."
                      : "Submit Confirmation"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Verification Process
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                  1
                </div>
                <p className="text-muted-foreground">
                  Submit your transfer details
                </p>
              </div>
              <div className="flex gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                  2
                </div>
                <p className="text-muted-foreground">
                  We verify your payment
                </p>
              </div>
              <div className="flex gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                  3
                </div>
                <p className="text-muted-foreground">
                  Balance updated automatically
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Need Help?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                If you have any questions about the payment process, please
                contact our support team.
              </p>
              <Button variant="outline" size="sm" className="mt-3" asChild>
                <Link href="/console/support-tickets/new">
                  Create Support Ticket
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  )
}

export default function ConfirmPaymentPage() {
  return (
    <Suspense
      fallback={
        <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
          <header className="space-y-1">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96" />
          </header>
          <Card>
            <CardContent className="p-6">
              <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            </CardContent>
          </Card>
        </main>
      }
    >
      <ConfirmationPageContent />
    </Suspense>
  )
}
