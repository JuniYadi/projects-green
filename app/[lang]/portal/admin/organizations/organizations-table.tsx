"use client"

import { useEffect, useState } from "react"
import { eden } from "@/lib/eden"
import { useRouter } from "next/navigation"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
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
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">#</TableHead>
              <TableHead>Organization</TableHead>
              <TableHead>ID</TableHead>
              <TableHead>Members</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {organizations.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="h-24 text-center text-muted-foreground"
                >
                  No organizations found
                </TableCell>
              </TableRow>
            ) : (
              organizations.map((org, index) => (
                <TableRow
                  key={org.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() =>
                    router.push(`/portal/admin/organizations/${org.id}`)
                  }
                >
                  <TableCell className="text-muted-foreground">
                    {index + 1}
                  </TableCell>
                  <TableCell className="font-medium">{org.name}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {org.id}
                  </TableCell>
                  <TableCell>{memberCounts[org.id] ?? "..."}</TableCell>
                  <TableCell>
                    {new Date(org.createdAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
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
