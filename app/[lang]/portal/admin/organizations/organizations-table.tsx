"use client"

import { useEffect, useMemo, useState } from "react"
import { eden } from "@/lib/eden"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { DataTable } from "@/components/data-table"
import { DataTableColumnHeader } from "@/components/data-table-column-header"
import type { ColumnDef } from "@tanstack/react-table"
import {
  MagnifyingGlassIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
} from "@phosphor-icons/react"
type Organization = {
  id: string
  name: string
  domains: string[]
  memberCount?: number
  createdAt: string
}

type ListMetadata = {
  before?: string
  after?: string
}

export function OrganizationsTable() {
  const router = useRouter()
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [listMetadata, setListMetadata] = useState<ListMetadata>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [cursor, setCursor] = useState<{ before?: string; after?: string }>({})
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({})

  useEffect(() => {
    const abortController = new AbortController()

    async function fetchData() {
      setIsLoading(true)
      setError(null)
      try {
        const searchParams = new URLSearchParams()
        searchParams.set("limit", "10")
        if (cursor.before) searchParams.set("before", cursor.before)
        if (cursor.after) searchParams.set("after", cursor.after)
        if (search) searchParams.set("search", search)

        const { data } = await eden.api.admin.organizations.get({
          $query: {
            limit: 10,
            ...(cursor.before && { before: cursor.before }),
            ...(cursor.after && { after: cursor.after }),
            ...(search && { search }),
          },
          $fetch: { signal: abortController.signal },
        })

        if (!data || !data.ok) {
          setError(
            data && "message" in data
              ? data.message
              : "Failed to load organizations"
          )
          return
        }
        setOrganizations(data.data.organizations)
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

    void fetchData()
    return () => abortController.abort()
  }, [cursor, search])

  useEffect(() => {
    if (organizations.length === 0) return

    const fetchMemberCounts = async () => {
      const counts: Record<string, number> = {}
      await Promise.all(
        organizations.map(async (org) => {
          try {
            const { data } =
              await eden.api.admin.organizations[org.id].members.get()
            if (data?.ok) {
              counts[org.id] = data.data.memberships.length
            }
          } catch {
            // Silently fail
          }
        })
      )
      setMemberCounts(counts)
    }

    void fetchMemberCounts()
  }, [organizations])

  const handleSearch = (value: string) => {
    setSearch(value)
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

  const columns = useMemo<ColumnDef<Organization>[]>(() => [
    {
      accessorKey: "name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Organization" />
      ),
      cell: ({ row }) => (
        <span
          className="cursor-pointer font-medium hover:bg-muted/50"
          onClick={() => router.push(`/portal/admin/organizations/${row.original.id}`)}
        >
          {row.original.name}
        </span>
      ),
    },
    {
      accessorKey: "id",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="ID" />
      ),
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">
          {row.original.id}
        </span>
      ),
    },
    {
      accessorKey: "memberCount",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Members" />
      ),
      cell: ({ row }) => (
        <span>{memberCounts[row.original.id] ?? "..."}</span>
      ),
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Created" />
      ),
      cell: ({ row }) => (
        <span>{new Date(row.original.createdAt).toLocaleDateString()}</span>
      ),
    },
  ], [router, memberCounts])

  if (isLoading && organizations.length === 0) {
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
      <div className="flex items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <MagnifyingGlassIcon className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search organizations..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>
      <DataTable
        tableId="portal-admin-organizations"
        columns={columns}
        data={organizations}
        searchPlaceholder="Search organizations..."
        searchableColumns={["name", "id"]}
        defaultColumnVisibility={{ id: false, createdAt: false }}
      />
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={handlePrev}
          disabled={!listMetadata.before || isLoading}
        >
          <ArrowLeftIcon className="mr-2 h-4 w-4" />
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleNext}
          disabled={!listMetadata.after || isLoading}
        >
          Next
          <ArrowRightIcon className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
