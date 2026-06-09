"use client"

import { FormEvent, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { AppMessages } from "@/lib/i18n/messages/types"
import type { TenantBillingCurrency } from "@/modules/tenants/contracts/tenant-api.contract"

type CreateOrganizationDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  isCreating: boolean
  error: string | null
  messages: AppMessages["navOrganization"]
  onSubmit: (input: { name: string; currency: TenantBillingCurrency }) => void
}

export function CreateOrganizationDialog({
  open,
  onOpenChange,
  isCreating,
  error,
  messages,
  onSubmit,
}: CreateOrganizationDialogProps) {
  const [name, setName] = useState("")
  const [currency, setCurrency] = useState<TenantBillingCurrency>("IDR")

  const handleOpenChange = (nextOpen: boolean) => {
    if (isCreating) {
      return
    }
    if (!nextOpen) {
      setName("")
      setCurrency("IDR")
    }
    onOpenChange(nextOpen)
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const candidateName = name.trim()
    if (!candidateName) {
      return
    }
    onSubmit({ name: candidateName, currency })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{messages.createOrganizationDialogTitle}</DialogTitle>
            <DialogDescription>
              {messages.createOrganizationDialogDescription}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="create-org-name">
                {messages.createOrganizationNameLabel}
              </Label>
              <Input
                id="create-org-name"
                value={name}
                placeholder={messages.createOrganizationPlaceholder}
                onChange={(event) => setName(event.target.value)}
                disabled={isCreating}
                autoFocus
                required
                aria-required="true"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="create-org-currency">
                {messages.createOrganizationCurrencyLabel}
              </Label>
              <Select
                value={currency}
                onValueChange={(value) =>
                  setCurrency(value === "USD" ? "USD" : "IDR")
                }
                disabled={isCreating}
              >
                <SelectTrigger id="create-org-currency" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="IDR">IDR</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {messages.createOrganizationCurrencyHint}
              </p>
            </div>
            {error ? (
              <p className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isCreating}
            >
              {messages.createOrganizationCancelLabel}
            </Button>
            <Button type="submit" disabled={isCreating || !name.trim()}>
              {isCreating
                ? messages.creatingOrganizationLabel
                : messages.createOrganizationActionLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
