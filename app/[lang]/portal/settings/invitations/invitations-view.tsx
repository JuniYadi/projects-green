"use client"

import { useParams } from "next/navigation"
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react"
import { eden } from "@/lib/eden"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DotsThreeVerticalIcon,
  PaperPlaneTiltIcon,
} from "@phosphor-icons/react"
import { Skeleton } from "@/components/ui/skeleton"
import { DataTable } from "@/components/data-table"
import { DataTableColumnHeader } from "@/components/data-table-column-header"
import type { ColumnDef } from "@tanstack/react-table"
import type {
  TenantInvitationSummary,
  TenantAuthorizationResponse,
} from "@/modules/tenants/contracts/tenant-api.contract"
import type { TenantAction } from "@/modules/tenants/tenant-policy"

type InvitationsViewProps = {
  organizationId: string
}

export function InvitationsView({ organizationId }: InvitationsViewProps) {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)
  const t = messages.pPortalSettingsInvitationsView

  const [invitations, setInvitations] = useState<TenantInvitationSummary[]>([])
  const [authorization, setAuthorization] =
    useState<TenantAuthorizationResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState("")
  const [role, setRole] = useState("member")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const loadData = useCallback(async () => {
    try {
      const [authRes, invRes] = await Promise.all([
        eden.api.tenants[organizationId].authorization
          .get()
          .then((r) => r.data),
        eden.api.tenants[organizationId].invitations.get().then((r) => r.data),
      ])

      if (authRes?.ok) setAuthorization(authRes as TenantAuthorizationResponse)
      if (invRes?.ok) {
        setInvitations(
          (invRes as { invitations: TenantInvitationSummary[] }).invitations
        )
      } else {
        setError(
          (invRes as { message?: string })?.message || t.errorFailedToLoad
        )
      }
    } catch {
      setError(t.errorUnexpected)
    } finally {
      setIsLoading(false)
    }
  }, [organizationId])

  useEffect(() => {
    ;(async () => {
      await loadData()
    })()
  }, [loadData])

  const handleInvite = async (e: FormEvent) => {
    e.preventDefault()
    if (!email) return

    setIsSubmitting(true)
    setError(null)
    try {
      const { data: res } = await eden.api.tenants[
        organizationId
      ].invitations.post({
        email,
        targetRole: role as "admin" | "owner" | "member",
      })

      if (res?.ok) {
        setEmail("")
        void loadData()
      } else {
        setError((res as { message?: string })?.message || t.errorFailedToSend)
      }
    } catch {
      setError(t.errorUnexpected)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAction = useCallback(
    async (
      edenCall: Promise<{
        data?: { ok?: boolean; message?: string } | null
        error?: unknown
      }>
    ) => {
      setError(null)
      try {
        const { data: res } = await edenCall
        if (res?.ok) {
          void loadData()
        } else {
          setError(res?.message || t.errorActionFailed)
        }
      } catch {
        setError(t.errorUnexpected)
      }
    },
    [loadData]
  )
  const columns = useMemo<ColumnDef<TenantInvitationSummary>[]>(
    () => [
      {
        accessorKey: "email",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t.columnEmail} />
        ),
        cell: ({ row }) => (
          <span className="font-medium">{row.original.email}</span>
        ),
      },
      {
        accessorKey: "roleSlug",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t.columnRole} />
        ),
        cell: ({ row }) => {
          const raw = row.original.roleSlug || "member"
          const cleaned = raw.replace(/^user_/i, "")
          return <span className="capitalize">{cleaned}</span>
        },
      },
      {
        accessorKey: "expiresAt",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t.columnExpires} />
        ),
        cell: ({ row }) => (
          <span>{new Date(row.original.expiresAt).toLocaleDateString()}</span>
        ),
      },
      {
        id: "actions",
        header: () => null,
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <DotsThreeVerticalIcon className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() =>
                  handleAction(
                    eden.api.tenants[organizationId].invitations[
                      row.original.id
                    ].resend.post()
                  )
                }
              >
                {t.actionResend}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => {
                  if (confirm(t.confirmRevoke)) {
                    handleAction(
                      eden.api.tenants[organizationId].invitations[
                        row.original.id
                      ].revoke.post()
                    )
                  }
                }}
              >
                {t.actionRevoke}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
        enableHiding: false,
      },
    ],
    [organizationId, handleAction]
  )

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-[200px] w-full" />
        <Skeleton className="h-[300px] w-full" />
      </div>
    )
  }

  const allowedActions = new Set(
    (authorization?.allowedActions as TenantAction[]) || []
  )
  const canInvite =
    allowedActions.has("invite_member") || allowedActions.has("invite_admin")

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {canInvite && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">
              {t.cardTitleInvite}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={handleInvite}
              className="flex flex-col gap-4 sm:flex-row"
            >
              <div className="flex-1">
                <Input
                  type="email"
                  placeholder="email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="w-full sm:w-[150px]">
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger>
                    <SelectValue placeholder={t.selectRolePlaceholder} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">{t.roleMember}</SelectItem>
                    {allowedActions.has("invite_admin") && (
                      <SelectItem value="admin">{t.roleAdmin}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={isSubmitting}>
                <PaperPlaneTiltIcon className="mr-2 h-4 w-4" />
                {isSubmitting ? t.sendingButton : t.sendButton}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
      <DataTable
        tableId="portal-settings-invitations"
        columns={columns}
        data={invitations}
        searchPlaceholder={t.searchPlaceholder}
        searchableColumns={["email"]}
        defaultColumnVisibility={{ actions: false }}
      />
    </div>
  )
}
