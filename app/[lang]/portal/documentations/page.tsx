import { useCallback, useEffect, useMemo, useState } from "react"
import { eden } from "@/lib/eden"
import { DocumentationForm } from "@/modules/docs/ui/documentation-form"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { TrashIcon } from "@phosphor-icons/react"
import { DataTable } from "@/components/data-table"
import { DataTableColumnHeader } from "@/components/data-table-column-header"
import type { ColumnDef } from "@tanstack/react-table"

type DocEntry = {
  id: string
  organizationId: string | null
  path: string
  title: string
  purpose: string
  howTo: string[]
  notes: string[]
  updatedAt: string
  score: number
}

export default function PortalDocumentationsPage() {
  const [docs, setDocs] = useState<DocEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [selectedDoc, setSelectedDoc] = useState<DocEntry | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const loadDocs = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const { data: res } = await eden.api.docs.list.get()
      if (res?.ok) {
        setDocs(res.docs)
      } else {
        setError(res?.message || "Failed to load docs")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadDocs()
  }, [loadDocs])

  const handleDelete = async (doc: DocEntry) => {
    if (
      !window.confirm(
        `Are you sure you want to delete "${doc.title}"? This action cannot be undone.`
      )
    )
      return
    setIsDeleting(true)
    try {
      const { data: res } = await eden.api.docs[doc.id].delete()
      if (res?.ok) {
        setDocs((prev) => prev.filter((d) => d.id !== doc.id))
        if (selectedDoc?.id === doc.id) setSelectedDoc(null)
      } else {
        setError(res?.message || "Failed to delete")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsDeleting(false)
    }
  }

  const filteredDocs = docs.filter(
    (doc) =>
      !search ||
      doc.title.toLowerCase().includes(search.toLowerCase()) ||
      doc.path.toLowerCase().includes(search.toLowerCase())
  )

  const columns = useMemo<ColumnDef<DocEntry>[]>(() => [
    {
      accessorKey: "title",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Title" />
      ),
      cell: ({ row }) => (
        <span
          className={`font-medium ${selectedDoc?.id === row.original.id ? "bg-muted" : ""} cursor-pointer hover:bg-muted/50`}
          onClick={() => setSelectedDoc(row.original)}
        >
          {row.original.title}
        </span>
      ),
    },
    {
      accessorKey: "path",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Path" />
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.path}
        </span>
      ),
    },
    {
      accessorKey: "updatedAt",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Updated" />
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.updatedAt}
        </span>
      ),
    },
    {
      id: "actions",
      header: () => null,
      cell: ({ row }) => (
        <Button
          aria-label={`Delete ${row.original.title}`}
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive"
          disabled={isDeleting}
          onClick={(e) => {
            e.stopPropagation()
            void handleDelete(row.original)
          }}
        >
          <TrashIcon className="h-4 w-4" />
        </Button>
      ),
      enableHiding: false,
    },
  ], [isDeleting, handleDelete, selectedDoc])

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Documentation Registry</h1>
        <p className="text-sm text-muted-foreground">
          Browse, create, edit, or delete documentation entries.
        </p>
      </header>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <section className="space-y-4">
        <Input
          placeholder="Search by title or path..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />

        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : (
        <DataTable
          tableId="portal-documentations"
          columns={columns}
          data={filteredDocs}
          searchPlaceholder="Search by title or path..."
          searchableColumns={["title", "path"]}
          defaultColumnVisibility={{}}
        />
        )}
      </section>

      <section className="rounded-lg border border-border p-4 md:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {selectedDoc ? `Edit: ${selectedDoc.title}` : "Create New Entry"}
          </h2>
          {selectedDoc && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSelectedDoc(null)}
            >
              Create New Entry
            </Button>
          )}
        </div>
        <DocumentationForm
          initialData={selectedDoc}
          onSuccess={() => void loadDocs()}
        />
      </section>
    </main>
  )
}
