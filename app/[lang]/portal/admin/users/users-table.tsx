"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { eden } from "@/lib/eden"
import { useParams, useRouter } from "next/navigation"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DataTable } from "@/components/data-table"
import { DataTableColumnHeader } from "@/components/data-table-column-header"
import type { ColumnDef } from "@tanstack/react-table"
import {
  MagnifyingGlassIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  Eye,
  CheckCircle,
  XCircle,
  BuildingsIcon,
} from "@phosphor-icons/react"

type AdminUser = {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  emailVerified: boolean
  profilePictureUrl: string | null
  lastSignInAt: string | null
  createdAt: string
  updatedAt: string
}

type AdminUserMembership = {
  id: string
  organizationId: string
  organizationName: string | null
  status: string
  roleSlug: string
  createdAt: string
  updatedAt: string
}

type AdminUserDetail = AdminUser & {
  memberships: AdminUserMembership[]
}

type OrganizationOption = {
  id: string
  name: string
}

type ListMetadata = {
  before?: string
  after?: string
}

export function UsersTable() {
  const router = useRouter()
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [listMetadata, setListMetadata] = useState<ListMetadata>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [selectedOrgId, setSelectedOrgId] = useState<string>("all")
  const [organizations, setOrganizations] = useState<OrganizationOption[]>([])
  const [cursor, setCursor] = useState<{ before?: string; after?: string }>({})

  // User detail dialog state
  const [selectedUser, setSelectedUser] = useState<AdminUserDetail | null>(null)
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)
  const [isDetailOpen, setIsDetailOpen] = useState(false)

  // Load organizations for filter dropdown
  useEffect(() => {
    async function loadOrgs() {
      try {
        const { data } = await eden.api.admin.organizations.get({
          $query: { limit: 100 },
        })
        if (data?.ok) {
          setOrganizations(
            data.data.organizations.map((org) => ({
              id: org.id,
              name: org.name,
            }))
          )
        }
      } catch {
        // non-fatal
      }
    }
    void loadOrgs()
  }, [])

  // Load users list
  useEffect(() => {
    const abortController = new AbortController()

    async function fetchUsers() {
      setIsLoading(true)
      setError(null)
      try {
        const query: {
          limit: number
          before?: string
          after?: string
          search?: string
          organizationId?: string
        } = {
          limit: 10,
          ...(cursor.before && { before: cursor.before }),
          ...(cursor.after && { after: cursor.after }),
          ...(search && { search }),
          ...(selectedOrgId !== "all" && { organizationId: selectedOrgId }),
        }

        const { data } = await eden.api.admin.users.get({
          $query: query,
          $fetch: { signal: abortController.signal },
        })

        if (!data || !data.ok) {
          setError(
            data && "message" in data ? data.message : "Failed to load users"
          )
          return
        }

        setUsers(data.data.users)
        setListMetadata(data.data.listMetadata ?? {})
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return
        setError(
          err instanceof Error ? err.message : "An unexpected error occurred"
        )
      } finally {
        setIsLoading(false)
      }
    }

    void fetchUsers()
    return () => abortController.abort()
  }, [cursor, search, selectedOrgId])

  const openUserDetails = useCallback(async (userId: string) => {
    setIsDetailOpen(true)
    setIsLoadingDetail(true)
    try {
      const { data } = await eden.api.admin.users[userId].get()
      if (data?.ok) {
        setSelectedUser(data.data)
      }
    } catch {
      // handled by empty state
    } finally {
      setIsLoadingDetail(false)
    }
  }, [])

  const handleSearch = (value: string) => {
    setSearch(value)
    setCursor({})
  }

  const handleOrgChange = (value: string) => {
    setSelectedOrgId(value)
    setCursor({})
  }

  const handlePrev = () => {
    if (listMetadata.before) {
      setCursor({ before: listMetadata.before })
    }
  }

  const handleNext = () => {
    if (listMetadata.after) {
      setCursor({ after: listMetadata.after })
    }
  }

  const columns = useMemo<ColumnDef<AdminUser>[]>(
    () => [
      {
        id: "user",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={messages.pPortalAdminUsersUsersTable.userColumn}
          />
        ),
        cell: ({ row }) => {
          const u = row.original
          const fullName =
            `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() ||
            u.email.split("@")[0]
          const initials = fullName
            .split(" ")
            .filter(Boolean)
            .map((p) => p[0])
            .slice(0, 2)
            .join("")
            .toUpperCase()

          return (
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8">
                {u.profilePictureUrl ? (
                  <AvatarImage src={u.profilePictureUrl} alt={fullName} />
                ) : null}
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="font-medium text-foreground">{fullName}</span>
                <span className="text-xs text-muted-foreground">{u.email}</span>
              </div>
            </div>
          )
        },
      },
      {
        accessorKey: "id",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={messages.pPortalAdminUsersUsersTable.userIdColumn}
          />
        ),
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.original.id}
          </span>
        ),
      },
      {
        accessorKey: "emailVerified",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={messages.pPortalAdminUsersUsersTable.emailVerifiedColumn}
          />
        ),
        cell: ({ row }) => {
          const verified = row.original.emailVerified
          return (
            <div className="flex items-center gap-1.5">
              {verified ? (
                <>
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                  <span className="text-xs text-muted-foreground">
                    {messages.pPortalAdminUsersUsersTable.verifiedLabel}
                  </span>
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 text-amber-500" />
                  <span className="text-xs text-muted-foreground">
                    {messages.pPortalAdminUsersUsersTable.unverifiedLabel}
                  </span>
                </>
              )}
            </div>
          )
        },
      },
      {
        accessorKey: "lastSignInAt",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={messages.pPortalAdminUsersUsersTable.lastSignInColumn}
          />
        ),
        cell: ({ row }) => {
          const date = row.original.lastSignInAt
          return (
            <span className="text-xs text-muted-foreground">
              {date ? new Date(date).toLocaleString() : "Never"}
            </span>
          )
        },
      },
      {
        accessorKey: "createdAt",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={messages.pPortalAdminUsersUsersTable.createdColumn}
          />
        ),
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {new Date(row.original.createdAt).toLocaleDateString()}
          </span>
        ),
      },
      {
        id: "actions",
        header: () => (
          <span className="sr-only">
            {messages.pPortalAdminUsersUsersTable.actionsColumn}
          </span>
        ),
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1 text-xs"
            onClick={() => void openUserDetails(row.original.id)}
          >
            <Eye className="h-3.5 w-3.5" />
            <span>{messages.pPortalAdminUsersUsersTable.detailsButton}</span>
          </Button>
        ),
      },
    ],
    [openUserDetails, messages]
  )

  if (isLoading && users.length === 0) {
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

      {/* Filters bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-72">
            <MagnifyingGlassIcon className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={
                messages.pPortalAdminUsersUsersTable.searchPlaceholder
              }
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-9 text-sm"
            />
          </div>

          <Select value={selectedOrgId} onValueChange={handleOrgChange}>
            <SelectTrigger className="w-56 text-sm">
              <SelectValue
                placeholder={
                  messages.pPortalAdminUsersUsersTable
                    .allOrganizationsPlaceholder
                }
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {
                  messages.pPortalAdminUsersUsersTable
                    .allOrganizationsPlaceholder
                }
              </SelectItem>
              {organizations.map((org) => (
                <SelectItem key={org.id} value={org.id}>
                  {org.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <DataTable
        tableId="portal-admin-users"
        columns={columns}
        data={users}
        hideSearch
      />

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={handlePrev}
          disabled={!listMetadata.before || isLoading}
        >
          <ArrowLeftIcon className="mr-1 h-4 w-4" />
          {messages.pPortalAdminUsersUsersTable.previousButton}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleNext}
          disabled={!listMetadata.after || isLoading}
        >
          {messages.pPortalAdminUsersUsersTable.nextButton}
          <ArrowRightIcon className="ml-1 h-4 w-4" />
        </Button>
      </div>

      {/* User Details Modal */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {messages.pPortalAdminUsersUsersTable.userProfileMembershipsTitle}
            </DialogTitle>
            <DialogDescription>
              {messages.pPortalAdminUsersUsersTable.userProfileDescription}
            </DialogDescription>
          </DialogHeader>

          {isLoadingDetail || !selectedUser ? (
            <div className="space-y-3 py-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
                <Avatar className="h-12 w-12">
                  {selectedUser.profilePictureUrl ? (
                    <AvatarImage
                      src={selectedUser.profilePictureUrl}
                      alt={selectedUser.email}
                    />
                  ) : null}
                  <AvatarFallback>
                    {(selectedUser.firstName?.[0] ?? "") +
                      (selectedUser.lastName?.[0] ?? "") || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-0.5">
                  <div className="font-semibold text-foreground">
                    {`${selectedUser.firstName ?? ""} ${selectedUser.lastName ?? ""}`.trim() ||
                      "Unnamed User"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {selectedUser.email}
                  </div>
                  <div className="font-mono text-[11px] text-muted-foreground">
                    {selectedUser.id}
                  </div>
                </div>
                <Badge
                  variant={selectedUser.emailVerified ? "secondary" : "outline"}
                >
                  {selectedUser.emailVerified
                    ? messages.pPortalAdminUsersUsersTable.verifiedLabel
                    : messages.pPortalAdminUsersUsersTable.unverifiedLabel}
                </Badge>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  {
                    messages.pPortalAdminUsersUsersTable
                      .organizationMembershipsCountPrefix
                  }
                  {selectedUser.memberships?.length ?? 0})
                </h4>
                {selectedUser.memberships?.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {
                      messages.pPortalAdminUsersUsersTable
                        .noOrganizationsMessage
                    }
                  </p>
                ) : (
                  <div className="max-h-56 divide-y overflow-y-auto rounded-md border">
                    {selectedUser.memberships.map((membership) => (
                      <div
                        key={membership.id}
                        className="flex items-center justify-between p-3 text-sm hover:bg-muted/40"
                      >
                        <div className="space-y-0.5">
                          <button
                            type="button"
                            onClick={() => {
                              setIsDetailOpen(false)
                              router.push(
                                `/portal/admin/organizations/${membership.organizationId}`
                              )
                            }}
                            className="flex items-center gap-1.5 font-medium text-foreground hover:underline"
                          >
                            <BuildingsIcon className="h-4 w-4 text-muted-foreground" />
                            <span>
                              {membership.organizationName ??
                                membership.organizationId}
                            </span>
                          </button>
                          <p className="font-mono text-[11px] text-muted-foreground">
                            {membership.organizationId}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {membership.roleSlug}
                          </Badge>
                          <Badge
                            variant={
                              membership.status === "active"
                                ? "secondary"
                                : "outline"
                            }
                            className="text-xs"
                          >
                            {membership.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
