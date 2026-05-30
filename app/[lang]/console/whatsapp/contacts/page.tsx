"use client"

import * as React from "react"
import {
  User,
  MagnifyingGlass,
  PencilSimple,
  Trash,
  UserPlus,
  CheckCircle,
  XCircle,
  DotsThreeVertical,
} from "@phosphor-icons/react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  whatsappClient,
  type Contact,
  type ContactGroup,
  type ContactStatus,
} from "@/modules/whatsapp/whatsapp-client"

// ─── Contact Status Badge ─────────────────────────────────────────────────

function ContactStatusBadge({
  status,
  isWhatsapp,
}: {
  status: ContactStatus
  isWhatsapp: boolean
}) {
  const isActive = status === "ACTIVE"

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
        isActive
          ? "text-green-600 bg-green-50 dark:bg-green-900/20"
          : "text-gray-500 bg-gray-50 dark:bg-gray-900/20"
      }`}
    >
      {isActive ? (
        <CheckCircle weight="fill" className="size-3.5" />
      ) : (
        <XCircle weight="fill" className="size-3.5" />
      )}
      {isActive ? "Active" : "Inactive"}
      {isWhatsapp && (
        <svg className="ml-0.5 size-3" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
      )}
    </span>
  )
}

// ─── Form Data Type ───────────────────────────────────────────────────────

type ContactFormData = {
  phoneNumber: string
  name: string
  email: string
  contactGroupId: string
  status: ContactStatus
}

const emptyFormData: ContactFormData = {
  phoneNumber: "",
  name: "",
  email: "",
  contactGroupId: "",
  status: "ACTIVE",
}

// ─── Page Component ───────────────────────────────────────────────────────

export default function WhatsAppContactsPage() {
  // ── Data state ──────────────────────────────────────────────────────────

  const [contacts, setContacts] = React.useState<Contact[]>([])
  const [groups, setGroups] = React.useState<ContactGroup[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [searchQuery, setSearchQuery] = React.useState("")

  // ── Dialog state ────────────────────────────────────────────────────────

  const [addDialogOpen, setAddDialogOpen] = React.useState(false)
  const [editDialogOpen, setEditDialogOpen] = React.useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [editingContact, setEditingContact] = React.useState<Contact | null>(
    null
  )
  const [deletingContact, setDeletingContact] =
    React.useState<Contact | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const [formData, setFormData] =
    React.useState<ContactFormData>(emptyFormData)

  // ── Data fetching ───────────────────────────────────────────────────────

  const loadContacts = React.useCallback(async () => {
    setIsLoading(true)
    setErrorMessage(null)
    try {
      const items = await whatsappClient.listContacts()
      setContacts(items)
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to load contacts."
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  const loadGroups = React.useCallback(async () => {
    try {
      const items = await whatsappClient.listGroups()
      setGroups(items)
    } catch {
      // Groups are secondary; silently fail
    }
  }, [])

  React.useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadContacts()
      void loadGroups()
    }, 0)
    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [loadContacts, loadGroups])

  // ── Filtered contacts (client-side search) ──────────────────────────────

  const filteredContacts = React.useMemo(() => {
    if (!searchQuery.trim()) return contacts
    const query = searchQuery.trim().toLowerCase()
    return contacts.filter(
      (c) =>
        c.phoneNumber.toLowerCase().includes(query) ||
        c.name.toLowerCase().includes(query) ||
        c.email.toLowerCase().includes(query)
    )
  }, [contacts, searchQuery])

  // ── Mutations ───────────────────────────────────────────────────────────

  const handleAdd = async () => {
    if (!formData.phoneNumber.trim()) {
      toast.error("Phone number is required.")
      return
    }

    setIsSubmitting(true)
    try {
      await whatsappClient.createContact({
        phoneNumber: formData.phoneNumber,
        name: formData.name,
        email: formData.email,
        contactGroupId: formData.contactGroupId,
        status: formData.status,
      })
      toast.success("Contact created successfully.")
      setAddDialogOpen(false)
      setFormData(emptyFormData)
      void loadContacts()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to create contact."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEdit = async () => {
    if (!editingContact) return
    if (!formData.phoneNumber.trim()) {
      toast.error("Phone number is required.")
      return
    }

    setIsSubmitting(true)
    try {
      await whatsappClient.updateContact(editingContact.id, {
        phoneNumber: formData.phoneNumber,
        name: formData.name,
        email: formData.email,
        contactGroupId: formData.contactGroupId,
        status: formData.status,
      })
      toast.success("Contact updated successfully.")
      setEditDialogOpen(false)
      setEditingContact(null)
      void loadContacts()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to update contact."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingContact) return

    setIsSubmitting(true)
    try {
      await whatsappClient.deleteContact(deletingContact.id)
      toast.success("Contact deleted successfully.")
      setDeleteDialogOpen(false)
      setDeletingContact(null)
      void loadContacts()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to delete contact."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Opening dialogs ─────────────────────────────────────────────────────

  const openAddDialog = () => {
    setFormData(emptyFormData)
    setAddDialogOpen(true)
  }

  const openEditDialog = (contact: Contact) => {
    setEditingContact(contact)
    setFormData({
      phoneNumber: contact.phoneNumber,
      name: contact.name,
      email: contact.email,
      contactGroupId: contact.contactGroupId,
      status: contact.status,
    })
    setEditDialogOpen(true)
  }

  const openDeleteDialog = (contact: Contact) => {
    setDeletingContact(contact)
    setDeleteDialogOpen(true)
  }

  // ── Groups lookup ───────────────────────────────────────────────────────

  const groupMap = React.useMemo(() => {
    const map = new Map<string, string>()
    for (const g of groups) {
      map.set(g.id, g.name)
    }
    return map
  }, [groups])

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 p-6">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Contacts</h1>
        <p className="text-muted-foreground">
          Manage your WhatsApp contacts and contact groups.
        </p>
      </div>

      {/* ── Main Card ──────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Contacts</CardTitle>
            <CardDescription>
              Manage your WhatsApp contacts
            </CardDescription>
          </div>
          <Button onClick={openAddDialog}>
            <UserPlus weight="bold" className="mr-2 size-4" />
            Add Contact
          </Button>
        </CardHeader>
        <CardContent>
          {/* ── Search ─────────────────────────────────────────────────── */}
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <MagnifyingGlass className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search contacts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* ── Stats ──────────────────────────────────────────────────── */}
          <div className="mb-6 grid grid-cols-3 gap-4">
            <div className="rounded-lg border p-4 text-center">
              <p className="text-2xl font-bold">{contacts.length}</p>
              <p className="text-xs text-muted-foreground">Total Contacts</p>
            </div>
            <div className="rounded-lg border p-4 text-center">
              <p className="text-2xl font-bold text-green-600">
                {contacts.filter((c) => c.status === "ACTIVE").length}
              </p>
              <p className="text-xs text-muted-foreground">Active</p>
            </div>
            <div className="rounded-lg border p-4 text-center">
              <p className="text-2xl font-bold text-blue-600">
                {contacts.filter((c) => c.isWhatsapp).length}
              </p>
              <p className="text-xs text-muted-foreground">Has WhatsApp</p>
            </div>
          </div>

          {/* ── Loading ────────────────────────────────────────────────── */}
          {isLoading && (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex items-center gap-4">
                    <Skeleton className="size-10 rounded-full" />
                    <div className="space-y-1.5">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                  <Skeleton className="h-6 w-16 rounded-full" />
                </div>
              ))}
            </div>
          )}

          {/* ── Error ──────────────────────────────────────────────────── */}
          {!isLoading && errorMessage && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <XCircle
                className="mb-3 size-10 text-destructive"
                weight="fill"
              />
              <p className="text-sm text-destructive">{errorMessage}</p>
              <Button
                variant="outline"
                className="mt-3"
                onClick={() => void loadContacts()}
              >
                Retry
              </Button>
            </div>
          )}

          {/* ── Empty ──────────────────────────────────────────────────── */}
          {!isLoading && !errorMessage && filteredContacts.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <User className="mb-3 size-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {searchQuery
                  ? "No contacts match your search"
                  : "No contacts yet"}
              </p>
              {!searchQuery && (
                <Button
                  variant="outline"
                  className="mt-3"
                  onClick={openAddDialog}
                >
                  Add your first contact
                </Button>
              )}
            </div>
          )}

          {/* ── Contact List ───────────────────────────────────────────── */}
          {!isLoading &&
            !errorMessage &&
            filteredContacts.length > 0 && (
              <div className="space-y-3">
                {filteredContacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="flex items-center justify-between rounded-lg border p-4"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
                        <User className="size-5 text-primary" weight="fill" />
                      </div>
                      <div>
                        <p className="font-medium">
                          {contact.name || contact.phoneNumber}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {contact.phoneNumber}
                        </p>
                        {contact.contactGroupId &&
                          groupMap.has(contact.contactGroupId) && (
                            <p className="text-xs text-muted-foreground">
                              {groupMap.get(contact.contactGroupId)}
                            </p>
                          )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <ContactStatusBadge
                        status={contact.status}
                        isWhatsapp={contact.isWhatsapp}
                      />
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm">
                            <span className="sr-only">Open menu</span>
                            <DotsThreeVertical
                              weight="bold"
                              className="size-4"
                            />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => openEditDialog(contact)}
                          >
                            <PencilSimple className="mr-2 size-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => openDeleteDialog(contact)}
                          >
                            <Trash className="mr-2 size-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            )}
        </CardContent>
      </Card>

      {/* ── Add Contact Dialog ──────────────────────────────────────────── */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Contact</DialogTitle>
            <DialogDescription>
              Add a new contact to your WhatsApp list.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="add-phone">
                Phone Number <span className="text-destructive">*</span>
              </Label>
              <Input
                id="add-phone"
                value={formData.phoneNumber}
                onChange={(e) =>
                  setFormData({ ...formData, phoneNumber: e.target.value })
                }
                placeholder="+1234567890"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-name">Name</Label>
              <Input
                id="add-name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="John Doe"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-email">Email</Label>
              <Input
                id="add-email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                placeholder="john@example.com"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-group">Group</Label>
              <Select
                value={formData.contactGroupId}
                onValueChange={(value) =>
                  setFormData({ ...formData, contactGroupId: value })
                }
              >
                <SelectTrigger id="add-group" className="w-full">
                  <SelectValue placeholder="No group" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    status: value as ContactStatus,
                  })
                }
              >
                <SelectTrigger id="add-status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddDialogOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleAdd()}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Adding..." : "Add Contact"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Contact Dialog ─────────────────────────────────────────── */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Contact</DialogTitle>
            <DialogDescription>
              Update contact details.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-phone">
                Phone Number <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-phone"
                value={formData.phoneNumber}
                onChange={(e) =>
                  setFormData({ ...formData, phoneNumber: e.target.value })
                }
                placeholder="+1234567890"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="John Doe"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                placeholder="john@example.com"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-group">Group</Label>
              <Select
                value={formData.contactGroupId}
                onValueChange={(value) =>
                  setFormData({ ...formData, contactGroupId: value })
                }
              >
                <SelectTrigger id="edit-group" className="w-full">
                  <SelectValue placeholder="No group" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    status: value as ContactStatus,
                  })
                }
              >
                <SelectTrigger id="edit-status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleEdit()}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog ──────────────────────────────────── */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Contact</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <strong>
                {deletingContact?.name || deletingContact?.phoneNumber}
              </strong>
              ? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleDelete()}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
