"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { type ColumnDef } from "@tanstack/react-table"

import { DataTable } from "@/components/data-table"
import { DataTableColumnHeader } from "@/components/data-table-column-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DotsThreeVertical,
  EnvelopeSimple,
  Bell,
  Headset,
  Spinner,
  Sparkle,
} from "@phosphor-icons/react"
import {
  getBillingAccount,
  addBillingContact,
  updateBillingContact,
  deactivateBillingContact,
  type BillingContactDTO,
  type BillingAccountDetail,
  type CreateContactInput,
} from "@/lib/billing-client"

// ─── Role badge ──────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  const variant =
    role === "OWNER"
      ? "default"
      : role === "FINANCE"
        ? "success"
        : role === "ACCOUNTING"
          ? "warning"
          : "secondary"

  return <Badge variant={variant}>{role}</Badge>
}

// ─── Notification toggle ─────────────────────────────────────────────────────

function NotificationToggle({
  label,
  icon: Icon,
  checked,
  disabled,
  onChange,
}: {
  label: string
  icon: React.ElementType
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
        checked
          ? "bg-primary/10 text-primary hover:bg-primary/20"
          : "bg-muted text-muted-foreground hover:bg-muted/80"
      } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
      aria-label={`${label} ${checked ? "enabled" : "disabled"}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  )
}

// ─── Row actions ─────────────────────────────────────────────────────────────

function RowActions({
  contact,
  onEdit,
  onDeactivate,
}: {
  contact: BillingContactDTO
  onEdit: (contact: BillingContactDTO) => void
  onDeactivate: (contact: BillingContactDTO) => void
}) {
  if (contact.role === "OWNER") {
    return null
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8">
          <DotsThreeVertical className="h-4 w-4" />
          <span className="sr-only">Actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem onClick={() => onEdit(contact)}>
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-destructive"
          onClick={() => onDeactivate(contact)}
        >
          Deactivate
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ─── Columns ─────────────────────────────────────────────────────────────────

const ROLE_FILTERS = [
  { label: "OWNER", value: "OWNER" },
  { label: "FINANCE", value: "FINANCE" },
  { label: "ACCOUNTING", value: "ACCOUNTING" },
  { label: "GENERAL", value: "GENERAL" },
]

// ─── Main component ──────────────────────────────────────────────────────────

export function BillingContactsList() {
  const [account, setAccount] = useState<BillingAccountDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Add contact dialog
  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState<CreateContactInput>({
    email: "",
    role: "GENERAL",
    notifyOnInvoice: true,
    notifyOnLowBalance: true,
    notifyOnSupport: true,
  })
  const [addSubmitting, setAddSubmitting] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  // Deactivate dialog
  const [deactivateTarget, setDeactivateTarget] =
    useState<BillingContactDTO | null>(null)
  const [deactivating, setDeactivating] = useState(false)

  // Edit dialog
  const [editTarget, setEditTarget] = useState<BillingContactDTO | null>(null)
  const [editName, setEditName] = useState("")
  const [editSubmitting, setEditSubmitting] = useState(false)

  const fetchAccount = useCallback(async () => {
    try {
      const result = await getBillingAccount()
      setAccount(result)
      setError(null)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load billing account"
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const run = async () => {
      await fetchAccount()
    }
    run()
  }, [fetchAccount])

  const contacts = useMemo(() => account?.contacts ?? [], [account])

  // First-time UX hint: when the server has only the auto-seeded OWNER
  // contact (created by getOrCreateAccountWithContacts on first access),
  // surface a one-time card so the user understands where the row came from
  // and is nudged to add finance/accounting contacts.
  const showOwnerHint = useMemo(
    () =>
      contacts.length === 1 &&
      contacts[0]?.role === "OWNER" &&
      contacts[0]?.isActive === true,
    [contacts]
  )

  const handleToggleNotification = useCallback(
    async (
      contact: BillingContactDTO,
      field: "notifyOnInvoice" | "notifyOnLowBalance" | "notifyOnSupport"
    ) => {
      const newValue = !contact[field]
      // Optimistic update
      setAccount((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          contacts: prev.contacts.map((c) =>
            c.id === contact.id ? { ...c, [field]: newValue } : c
          ),
        }
      })

      try {
        await updateBillingContact(contact.id, { [field]: newValue })
      } catch {
        // Revert on error
        setAccount((prev) => {
          if (!prev) return prev
          return {
            ...prev,
            contacts: prev.contacts.map((c) =>
              c.id === contact.id ? { ...c, [field]: !newValue } : c
            ),
          }
        })
      }
    },
    []
  )

  const handleAddContact = useCallback(async () => {
    setAddSubmitting(true)
    setAddError(null)

    try {
      const result = await addBillingContact(addForm)
      // Update local list with the returned contact
      setAccount((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          contacts: [...prev.contacts, result],
        }
      })
      setAddOpen(false)
      setAddForm({
        email: "",
        role: "GENERAL",
        notifyOnInvoice: true,
        notifyOnLowBalance: true,
        notifyOnSupport: true,
      })
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Failed to add contact")
    } finally {
      setAddSubmitting(false)
    }
  }, [addForm])

  const handleDeactivateContact = useCallback(async () => {
    if (!deactivateTarget) return
    setDeactivating(true)

    try {
      await deactivateBillingContact(deactivateTarget.id)
      setAccount((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          contacts: prev.contacts.filter((c) => c.id !== deactivateTarget.id),
        }
      })
      setDeactivateTarget(null)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to deactivate contact"
      )
    } finally {
      setDeactivating(false)
    }
  }, [deactivateTarget])

  const handleEditContact = useCallback(async () => {
    if (!editTarget) return
    setEditSubmitting(true)

    try {
      const result = await updateBillingContact(editTarget.id, {
        name: editName || null,
      })
      setAccount((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          contacts: prev.contacts.map((c) =>
            c.id === editTarget.id ? { ...c, ...result } : c
          ),
        }
      })
      setEditTarget(null)
    } catch {
      // Silently handle
    } finally {
      setEditSubmitting(false)
    }
  }, [editTarget, editName])

  const columns = useMemo<ColumnDef<BillingContactDTO, unknown>[]>(
    () => [
      {
        accessorKey: "email",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Email" />
        ),
        cell: ({ row }) => (
          <span className="font-medium">{row.original.email}</span>
        ),
      },
      {
        accessorKey: "name",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Name" />
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.name ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "role",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Role" />
        ),
        cell: ({ row }) => <RoleBadge role={row.original.role} />,
      },
      {
        id: "notifications",
        header: "Notifications",
        cell: ({ row }) => {
          const contact = row.original
          return (
            <div className="flex items-center gap-1.5">
              <NotificationToggle
                label="Invoice"
                icon={EnvelopeSimple}
                checked={contact.notifyOnInvoice}
                onChange={() =>
                  handleToggleNotification(contact, "notifyOnInvoice")
                }
              />
              <NotificationToggle
                label="Alerts"
                icon={Bell}
                checked={contact.notifyOnLowBalance}
                onChange={() =>
                  handleToggleNotification(contact, "notifyOnLowBalance")
                }
              />
              <NotificationToggle
                label="Support"
                icon={Headset}
                checked={contact.notifyOnSupport}
                onChange={() =>
                  handleToggleNotification(contact, "notifyOnSupport")
                }
              />
            </div>
          )
        },
      },
      {
        id: "actions",
        cell: ({ row }) => (
          <RowActions
            contact={row.original}
            onEdit={(c) => {
              setEditTarget(c)
              setEditName(c.name ?? "")
            }}
            onDeactivate={setDeactivateTarget}
          />
        ),
      },
    ],
    [handleToggleNotification]
  )

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4">
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-2"
          onClick={() => {
            setLoading(true)
            setError(null)
            void fetchAccount()
          }}
        >
          Retry
        </Button>
      </div>
    )
  }

  return (
    <>
      {showOwnerHint ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm"
        >
          <Sparkle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="space-y-1">
            <p className="font-medium text-foreground">
              You&rsquo;ve been added as the OWNER contact
            </p>
            <p className="text-muted-foreground">
              We pre-filled your address so billing notifications never get
              lost. Add your finance or accounting team below to keep them in
              the loop on invoices and low balance alerts.
            </p>
          </div>
        </div>
      ) : null}

      <DataTable
        tableId="console-billing-contacts"
        columns={columns}
        data={contacts}
        searchableColumns={["email", "name"]}
        searchPlaceholder="Search contacts..."
        facetFilters={[
          {
            columnId: "role",
            label: "Role",
            allLabel: "All roles",
            options: ROLE_FILTERS,
          },
        ]}
        emptyMessage="No billing contacts yet. Add one to start receiving notifications."
      />

      {/* Add Contact button */}
      <div className="flex justify-end">
        <Button onClick={() => setAddOpen(true)}>+ Add Contact</Button>
      </div>

      {/* ─── Add Contact Dialog ───────────────────────────────────────────── */}
      <Dialog
        open={addOpen}
        onOpenChange={(open) => {
          if (!open) {
            setAddError(null)
            setAddForm({
              email: "",
              role: "GENERAL",
              notifyOnInvoice: true,
              notifyOnLowBalance: true,
              notifyOnSupport: true,
            })
          }
          setAddOpen(open)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Billing Contact</DialogTitle>
            <DialogDescription>
              Add a new email address to receive billing notifications.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {/* Email */}
            <div className="grid gap-2">
              <Label htmlFor="email">
                Email <span className="text-destructive">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="finance@example.com"
                value={addForm.email}
                onChange={(e) =>
                  setAddForm((prev) => ({ ...prev, email: e.target.value }))
                }
              />
            </div>

            {/* Display Name */}
            <div className="grid gap-2">
              <Label htmlFor="name">Display Name (optional)</Label>
              <Input
                id="name"
                placeholder="Finance Team"
                value={addForm.name ?? ""}
                onChange={(e) =>
                  setAddForm((prev) => ({
                    ...prev,
                    name: e.target.value || undefined,
                  }))
                }
              />
            </div>

            {/* Role */}
            <div className="grid gap-2">
              <Label htmlFor="role">Role</Label>
              <Select
                value={addForm.role ?? "GENERAL"}
                onValueChange={(value: "FINANCE" | "ACCOUNTING" | "GENERAL") =>
                  setAddForm((prev) => ({ ...prev, role: value }))
                }
              >
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FINANCE">Finance</SelectItem>
                  <SelectItem value="ACCOUNTING">Accounting</SelectItem>
                  <SelectItem value="GENERAL">General</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Notification toggles */}
            <div className="grid gap-3">
              <Label>Notifications</Label>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="add-notify-invoice"
                  checked={addForm.notifyOnInvoice}
                  onCheckedChange={(checked) =>
                    setAddForm((prev) => ({
                      ...prev,
                      notifyOnInvoice: checked === true,
                    }))
                  }
                />
                <Label
                  htmlFor="add-notify-invoice"
                  className="text-sm font-normal"
                >
                  Invoice notifications
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="add-notify-alerts"
                  checked={addForm.notifyOnLowBalance}
                  onCheckedChange={(checked) =>
                    setAddForm((prev) => ({
                      ...prev,
                      notifyOnLowBalance: checked === true,
                    }))
                  }
                />
                <Label
                  htmlFor="add-notify-alerts"
                  className="text-sm font-normal"
                >
                  Low balance alerts
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="add-notify-support"
                  checked={addForm.notifyOnSupport}
                  onCheckedChange={(checked) =>
                    setAddForm((prev) => ({
                      ...prev,
                      notifyOnSupport: checked === true,
                    }))
                  }
                />
                <Label
                  htmlFor="add-notify-support"
                  className="text-sm font-normal"
                >
                  Support notifications
                </Label>
              </div>
            </div>

            {addError && <p className="text-sm text-destructive">{addError}</p>}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddOpen(false)}
              disabled={addSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleAddContact()}
              disabled={addSubmitting || !addForm.email.trim()}
            >
              {addSubmitting ? (
                <>
                  <Spinner className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Contact"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Edit Name Dialog ───────────────────────────────────────────────── */}
      <Dialog
        open={editTarget !== null}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null)
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Contact</DialogTitle>
            <DialogDescription>
              Update the display name for {editTarget?.email}.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2 py-2">
            <Label htmlFor="edit-name">Display Name</Label>
            <Input
              id="edit-name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Enter display name"
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditTarget(null)}
              disabled={editSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleEditContact()}
              disabled={editSubmitting}
            >
              {editSubmitting ? (
                <>
                  <Spinner className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Deactivate Confirmation Dialog ────────────────────────────────── */}
      <Dialog
        open={deactivateTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeactivateTarget(null)
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Deactivate Contact</DialogTitle>
            <DialogDescription>
              Are you sure you want to deactivate{" "}
              <strong>{deactivateTarget?.email}</strong>? They will no longer
              receive billing notifications.
            </DialogDescription>
          </DialogHeader>

          {deactivateTarget && (
            <div className="rounded-lg border p-3 text-sm">
              <p className="font-medium">{deactivateTarget.email}</p>
              <p className="text-muted-foreground">
                Role: {deactivateTarget.role}
              </p>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeactivateTarget(null)}
              disabled={deactivating}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleDeactivateContact()}
              disabled={deactivating}
            >
              {deactivating ? (
                <>
                  <Spinner className="mr-2 h-4 w-4 animate-spin" />
                  Deactivating...
                </>
              ) : (
                "Deactivate"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
