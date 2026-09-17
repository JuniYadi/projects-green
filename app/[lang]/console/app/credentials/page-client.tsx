"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { useCallback, useEffect, useMemo, useState } from "react"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { eden } from "@/lib/eden"
import { DataTable } from "@/components/data-table"
import { DataTableColumnHeader } from "@/components/data-table-column-header"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Spinner } from "@phosphor-icons/react"
import { getMessages } from "@/lib/i18n/messages"
import { useParams, useSearchParams } from "next/navigation"
import { LifecyclePageShell } from "@/modules/deploy/ui/lifecycle-page-shell"
import type { AppCredentialType, AppCredentialStatus } from "@prisma/client"
import {
  credentialTypeRegistry,
  getCredentialTypeDef,
} from "@/modules/credentials/credential-type-registry"
import { AddCredentialDialog } from "./_components/add-credential-dialog"

// ─── Types ──────────────────────────────────────────────────────────────────

type AppCredentialListItem = {
  id: string
  type: AppCredentialType
  name: string
  metadata: unknown
  maskedPreview: string
  status: AppCredentialStatus
  createdAt: string | Date
  updatedAt: string | Date
}

type CredentialListRequestState =
  | { status: "loading" }
  | { status: "success"; data: AppCredentialListItem[] }
  | { status: "error"; message: string }

type Messages = ReturnType<typeof getMessages>

// ─── Constants ──────────────────────────────────────────────────────────────

const CREDENTIAL_TYPE_OPTIONS = Object.keys(credentialTypeRegistry).map(
  (key) => ({
    label: getCredentialTypeDef(key as AppCredentialType).label,
    value: key,
  })
)

const getStatusOptions = (messages: Messages) => [
  {
    label: messages.pConsoleCredentialsPageClient.statusActive,
    value: "ACTIVE",
  },
  {
    label: messages.pConsoleCredentialsPageClient.statusPending,
    value: "PENDING",
  },
  {
    label: messages.pConsoleCredentialsPageClient.statusRevoked,
    value: "REVOKED",
  },
  {
    label: messages.pConsoleCredentialsPageClient.statusExpired,
    value: "EXPIRED",
  },
]

// ─── Helpers ────────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: AppCredentialStatus }) {
  const styles: Record<AppCredentialStatus, string> = {
    ACTIVE: "bg-green-100 text-green-800",
    PENDING: "bg-yellow-100 text-yellow-800",
    REVOKED: "bg-red-100 text-red-800",
    EXPIRED: "bg-red-100 text-red-800",
  }

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${styles[status]}`}
    >
      {status}
    </span>
  )
}

function formatDate(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

// ─── Columns ────────────────────────────────────────────────────────────────

const getColumns = (
  onRevoke: (id: string) => void,
  onDelete: (id: string) => void,
  messages: Messages
): ColumnDef<AppCredentialListItem>[] => [
  {
    accessorKey: "name",
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title={messages.pConsoleCredentialsPageClient.columnName}
      />
    ),
  },
  {
    accessorKey: "type",
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title={messages.pConsoleCredentialsPageClient.columnType}
      />
    ),
    cell: ({ row }) => getCredentialTypeDef(row.original.type).label,
  },
  {
    accessorKey: "status",
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title={messages.pConsoleCredentialsPageClient.columnStatus}
      />
    ),
    cell: ({ row }) => <StatusPill status={row.original.status} />,
  },
  {
    accessorKey: "maskedPreview",
    header: messages.pConsoleCredentialsPageClient.columnPreview,
    cell: ({ row }) => (
      <span className="font-mono text-xs text-muted-foreground">
        {row.original.maskedPreview}
      </span>
    ),
    enableSorting: false,
  },
  {
    accessorKey: "createdAt",
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title={messages.pConsoleCredentialsPageClient.columnCreated}
      />
    ),
    cell: ({ row }) => formatDate(row.original.createdAt),
    sortingFn: "datetime",
  },
  {
    id: "actions",
    header: () => (
      <span>{messages.pConsoleCredentialsPageClient.columnActions}</span>
    ),
    cell: ({ row }) => {
      const cred = row.original
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 px-2">
              <span className="sr-only">
                {messages.pConsoleCredentialsPageClient.openActions}
              </span>
              &#8942;
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {cred.status === "ACTIVE" && (
              <DropdownMenuItem
                onClick={() => {
                  if (
                    window.confirm(
                      messages.pConsoleCredentialsPageClient.confirmRevoke
                    )
                  )
                    onRevoke(cred.id)
                }}
              >
                {messages.pConsoleCredentialsPageClient.revokeAction}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => {
                if (
                  window.confirm(
                    messages.pConsoleCredentialsPageClient.confirmDelete
                  )
                )
                  onDelete(cred.id)
              }}
            >
              {messages.pConsoleCredentialsPageClient.deleteAction}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
    enableSorting: false,
    enableHiding: false,
  },
]

// ─── Component ──────────────────────────────────────────────────────────────

export default function CredentialsPage() {
  const params = useParams<{ lang?: string }>()
  const searchParams = useSearchParams()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)

  const [state, setState] = useState<CredentialListRequestState>({
    status: "loading",
  })
  const isNewParam =
    searchParams?.get("action") === "new" || searchParams?.get("new") === "true"
  const [addDialogOpen, setAddDialogOpen] = useState(isNewParam)

  useEffect(() => {
    if (
      searchParams?.get("action") === "new" ||
      searchParams?.get("new") === "true"
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAddDialogOpen(true)
    }
  }, [searchParams])

  const fetchCredentials = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const { data: payload } = await eden.api.app.credentials.get({
          $fetch: { signal },
        })

        if (!payload || payload.ok !== true) {
          let message = messages.pConsoleCredentialsPageClient.loadError
          if (
            payload &&
            "error" in payload &&
            typeof payload.error === "string"
          ) {
            message = payload.error
          }
          setState({ status: "error", message })
          return
        }

        setState({ status: "success", data: payload.credentials ?? [] })
      } catch {
        if (signal?.aborted) return
        setState({
          status: "error",
          message: messages.pConsoleCredentialsPageClient.loadErrorRetry,
        })
      }
    },
    [messages]
  )

  useEffect(() => {
    const controller = new AbortController()
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchCredentials(controller.signal)
    return () => controller.abort()
  }, [fetchCredentials])

  const handleRevoke = async (id: string) => {
    try {
      // eden treaty uses bracket access for :id path params
      const { data: payload } = await eden.api.app.credentials[id].revoke.post()
      if (payload?.ok) {
        void fetchCredentials()
      } else {
        alert(
          payload && "error" in payload && typeof payload.error === "string"
            ? payload.error
            : messages.pConsoleCredentialsPageClient.revokeFailed
        )
      }
    } catch {
      alert(messages.pConsoleCredentialsPageClient.networkError)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      // eden treaty uses bracket access for :id path params
      const { data: payload } = await eden.api.app.credentials[id].delete()
      if (payload?.ok) {
        void fetchCredentials()
      } else {
        alert(
          payload && "error" in payload && typeof payload.error === "string"
            ? payload.error
            : messages.pConsoleCredentialsPageClient.deleteFailed
        )
      }
    } catch {
      alert(messages.pConsoleCredentialsPageClient.networkError)
    }
  }

  const columns = useMemo(
    () => getColumns(handleRevoke, handleDelete, messages),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [messages]
  )

  if (state.status === "loading") {
    return (
      <LifecyclePageShell
        title={messages.console.app.credentials.heading}
        description={messages.console.app.credentials.description}
      >
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner className="size-4 animate-spin" />
          {messages.pConsoleCredentialsPageClient.loadingCredentials}
        </div>
      </LifecyclePageShell>
    )
  }

  if (state.status === "error") {
    return (
      <LifecyclePageShell
        title={messages.console.app.credentials.heading}
        description={messages.console.app.credentials.description}
      >
        <div className="grid gap-3 rounded-md border border-destructive/20 bg-destructive/5 p-4 text-sm">
          <p className="text-destructive">{state.message}</p>
          <div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void fetchCredentials()}
            >
              {messages.pConsoleCredentialsPageClient.retry}
            </Button>
          </div>
        </div>
      </LifecyclePageShell>
    )
  }

  return (
    <LifecyclePageShell
      title={messages.console.app.credentials.heading}
      description={messages.console.app.credentials.description}
    >
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setAddDialogOpen(true)}>
          {messages.pConsoleCredentialsPageClient.addCredential}
        </Button>
      </div>

      <AddCredentialDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSuccess={() => void fetchCredentials()}
      />

      <DataTable
        tableId="console-credentials"
        columns={columns}
        data={state.data}
        searchPlaceholder={
          messages.pConsoleCredentialsPageClient.searchPlaceholder
        }
        searchableColumns={["name"]}
        facetFilters={[
          {
            columnId: "type",
            label: messages.pConsoleCredentialsPageClient.columnType,
            allLabel: messages.pConsoleCredentialsPageClient.allTypes,
            options: CREDENTIAL_TYPE_OPTIONS,
          },
          {
            columnId: "status",
            label: messages.pConsoleCredentialsPageClient.columnStatus,
            allLabel: messages.pConsoleCredentialsPageClient.allStatus,
            options: getStatusOptions(messages),
          },
        ]}
        initialSorting={[{ id: "createdAt", desc: true }]}
        emptyMessage={messages.pConsoleCredentialsPageClient.emptyMessage}
      />
    </LifecyclePageShell>
  )
}
