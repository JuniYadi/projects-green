"use client"

import { useQuery } from "@tanstack/react-query"
import { useParams } from "next/navigation"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, ChevronLeft } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

type DocDetail = {
  path: string
  title: string
  purpose: string
  howTo: string[]
  notes?: string[]
  updatedAt: string
}

type DocResponse = {
  ok: boolean
  error?: string
  message?: string
} & Partial<DocDetail>

export default function DocDetailPage() {
  const params = useParams()
  const slug = Array.isArray(params.slug) ? params.slug.join("/") : params.slug
  const path = `/${slug}`

  const { data, isLoading } = useQuery<DocResponse>({
    queryKey: ["docs", "detail", path],
    queryFn: () => fetch(`/api/docs?path=${encodeURIComponent(path)}`).then((res) => res.json()),
  })

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-6 pt-0">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (data?.ok === false) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-6 pt-0">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {data.message || "Could not load documentation."}
          </AlertDescription>
        </Alert>
        <Button asChild variant="outline" className="w-fit">
          <Link href="/console/docs">
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back to Docs
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon">
          <Link href="/console/docs">
            <ChevronLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex flex-col">
          <h1 className="text-3xl font-bold tracking-tight">{data?.title}</h1>
          <p className="text-muted-foreground">{data?.path}</p>
        </div>
      </div>

      <div className="grid gap-6">
        <section>
          <h2 className="text-xl font-semibold mb-2">Purpose</h2>
          <p className="text-muted-foreground leading-relaxed">
            {data?.purpose}
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">How-To</h2>
          <ul className="list-decimal list-inside space-y-2 text-muted-foreground">
            {data?.howTo?.map((step: string, i: number) => (
              <li key={i} className="pl-2">{step}</li>
            ))}
          </ul>
        </section>

        {data?.notes && data.notes.length > 0 && (
          <section>
            <h2 className="text-xl font-semibold mb-2">Notes</h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              {data.notes.map((note: string, i: number) => (
                <li key={i} className="pl-2">{note}</li>
              ))}
            </ul>
          </section>
        )}

        <div className="text-xs text-muted-foreground pt-6 border-t">
          Last updated: {data?.updatedAt ? new Date(data.updatedAt).toLocaleDateString() : "Unknown"}
        </div>
      </div>
    </div>
  )
}
