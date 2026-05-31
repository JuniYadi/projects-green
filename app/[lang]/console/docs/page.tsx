"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { Search } from "lucide-react"
import { useState } from "react"

import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

type DocListing = {
  id: string
  path: string
  title: string
  updatedAt: string
  isGlobal: boolean
}

type DocsListResponse = {
  ok: boolean
  docs: DocListing[]
}

export default function DocsPage() {
  const [search, setSearch] = useState("")

  const { data, isLoading } = useQuery<DocsListResponse>({
    queryKey: ["docs", "list"],
    queryFn: () => fetch("/api/docs/list").then((res) => res.json()),
  })

  const filteredDocs = data?.docs?.filter((doc: DocListing) =>
    doc.title.toLowerCase().includes(search.toLowerCase()) ||
    doc.path.toLowerCase().includes(search.toLowerCase())
  ) ?? []

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Documentation</h1>
        <p className="text-muted-foreground">
          Browse and search through platform and organization documentation.
        </p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search documentation..."
          className="pl-8"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i: number) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredDocs.map((doc: DocListing) => (
            <Link key={doc.id} href={`/console/docs/${doc.path.replace(/^\//, "")}`}>
              <Card className="h-full hover:bg-muted/50 transition-colors">
                <CardHeader>
                  <CardTitle className="line-clamp-1">{doc.title}</CardTitle>
                  <CardDescription>{doc.path}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Last updated: {new Date(doc.updatedAt).toLocaleDateString()}
                    {doc.isGlobal && <span className="ml-2 inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground">Global</span>}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
          {filteredDocs.length === 0 && (
            <div className="col-span-full py-12 text-center text-muted-foreground">
              No documentation found matching your search.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
