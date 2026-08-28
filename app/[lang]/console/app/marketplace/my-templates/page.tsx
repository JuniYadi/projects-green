"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  ArrowLeft,
  Boxes,
  Clock,
  Globe,
  Lock,
  Plus,
  Rocket,
  Search,
} from "lucide-react"
import { eden } from "@/lib/eden"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"

export interface WorkspaceTemplate {
  id: string
  slug: string
  name: string
  tagline: string
  description: string
  category: string
  visibility: "PRIVATE" | "PENDING_REVIEW" | "PUBLIC" | "REJECTED" | "UNLISTED"
  isOfficial: boolean
  isFeatured: boolean
  installCount: number
  createdAt: string
  updatedAt: string
  iconUrl?: string | null
}

export default function MyTemplatesPage() {
  const params = useParams()
  const router = useRouter()
  const lang = (params?.lang as string) || "en"

  const [templates, setTemplates] = useState<WorkspaceTemplate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    let isCancelled = false
    const load = async () => {
      setIsLoading(true)
      try {
        const res = await (
          eden.api.templates as unknown as {
            workspace: {
              get: () => Promise<{
                data?: unknown
                error?: { value?: { message?: string } }
              }>
            }
          }
        ).workspace.get()
        if (res.error) {
          throw new Error(
            res.error.value?.message || "Failed to load workspace templates"
          )
        }
        if (!isCancelled) {
          setTemplates(
            Array.isArray(res.data) ? (res.data as WorkspaceTemplate[]) : []
          )
        }
      } catch (error: unknown) {
        if (!isCancelled) {
          const message =
            error instanceof Error ? error.message : "Error loading templates"
          toast.error(message)
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }
    load()
    return () => {
      isCancelled = true
    }
  }, [])

  const reloadWorkspaceTemplates = async () => {
    setIsLoading(true)
    try {
      const res = await (
        eden.api.templates as unknown as {
          workspace: {
            get: () => Promise<{
              data?: unknown
              error?: { value?: { message?: string } }
            }>
          }
        }
      ).workspace.get()
      if (res.error) {
        throw new Error(
          res.error.value?.message || "Failed to load workspace templates"
        )
      }
      setTemplates(
        Array.isArray(res.data) ? (res.data as WorkspaceTemplate[]) : []
      )
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Error loading templates"
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  const filteredTemplates = templates.filter((tpl) => {
    if (!searchQuery.trim()) return true
    const term = searchQuery.toLowerCase()
    return (
      tpl.name.toLowerCase().includes(term) ||
      tpl.tagline.toLowerCase().includes(term) ||
      tpl.category.toLowerCase().includes(term)
    )
  })

  const getVisibilityBadge = (visibility: string) => {
    switch (visibility) {
      case "PUBLIC":
        return (
          <Badge
            variant="outline"
            className="gap-1 border-emerald-500/30 bg-emerald-500/10 font-medium text-emerald-600 dark:text-emerald-400"
          >
            <Globe className="h-3 w-3" />
            PUBLIC
          </Badge>
        )
      case "PENDING_REVIEW":
        return (
          <Badge
            variant="outline"
            className="gap-1 border-amber-500/30 bg-amber-500/10 font-medium text-amber-600 dark:text-amber-400"
          >
            <Clock className="h-3 w-3" />
            PENDING_REVIEW
          </Badge>
        )
      case "PRIVATE":
      default:
        return (
          <Badge
            variant="outline"
            className="gap-1 border-muted-foreground/30 bg-muted font-medium text-muted-foreground"
          >
            <Lock className="h-3 w-3" />
            PRIVATE
          </Badge>
        )
    }
  }

  const handleSubmitForReview = async (id: string) => {
    try {
      const reviewApi = (
        eden.api.templates as unknown as Record<
          string,
          {
            "submit-review": {
              post: () => Promise<{
                data?: { ok?: boolean }
                error?: { value?: { message?: string } }
              }>
            }
          }
        >
      )[id]
      const res = await reviewApi?.["submit-review"].post()
      if (res?.error || !res?.data?.ok) {
        throw new Error(
          res?.error?.value?.message || "Failed to submit for review"
        )
      }
      toast.success("Template submitted for marketplace review!")
      reloadWorkspaceTemplates()
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Submission failed"
      toast.error(message)
    }
  }
  return (
    <div className="flex flex-1 flex-col gap-6 p-6 pt-0">
      {/* Header & CTAs */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Button
              variant="ghost"
              size="sm"
              className="-ml-2 h-7 px-2 text-muted-foreground hover:text-foreground"
              onClick={() => router.push(`/${lang}/console/app/marketplace`)}
            >
              <ArrowLeft className="mr-1 h-4 w-4" />
              Marketplace
            </Button>
            <span>/</span>
            <span>Workspace Templates</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            My Workspace Templates
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage your organization&apos;s custom application templates, review
            visibility status, and publish to the public marketplace.
          </p>
        </div>

        <Button
          className="bg-primary text-primary-foreground hover:bg-primary/90"
          onClick={() =>
            router.push(`/${lang}/console/app/marketplace/builder`)
          }
        >
          <Plus className="mr-2 h-4 w-4" />
          Create Template
        </Button>
      </div>

      {/* Main Content Card */}
      <Card className="border-border bg-card">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-lg">Custom Templates</CardTitle>
            <CardDescription>
              Templates exclusively available to your organization or submitted
              for marketplace verification.
            </CardDescription>
          </div>

          <div className="relative w-full max-w-xs">
            <Search className="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search custom templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="space-y-2 py-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
              <Boxes className="mb-3 h-10 w-10 text-muted-foreground/50" />
              <h3 className="text-base font-semibold">No Templates Found</h3>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                {searchQuery
                  ? "No templates match your search criteria. Try a different search term."
                  : "Your organization has not created any custom templates yet. Build reusable stack blueprints with our visual designer."}
              </p>
              {!searchQuery && (
                <Button
                  className="mt-4 bg-primary text-primary-foreground hover:bg-primary/90"
                  size="sm"
                  onClick={() =>
                    router.push(`/${lang}/console/app/marketplace/builder`)
                  }
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Create First Template
                </Button>
              )}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Template</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">Installs</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTemplates.map((tpl) => (
                    <TableRow key={tpl.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-semibold text-foreground">
                            {tpl.name}
                          </span>
                          <span className="line-clamp-1 text-xs text-muted-foreground">
                            {tpl.tagline}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {tpl.category}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {getVisibilityBadge(tpl.visibility)}
                      </TableCell>
                      <TableCell className="text-center font-mono text-sm">
                        {tpl.installCount}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {tpl.visibility === "PRIVATE" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs"
                              onClick={() => handleSubmitForReview(tpl.id)}
                            >
                              Submit Review
                            </Button>
                          )}
                          <Button
                            variant="secondary"
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() =>
                              router.push(
                                `/${lang}/console/app/deploy?template=${tpl.slug}`
                              )
                            }
                          >
                            <Rocket className="mr-1 h-3.5 w-3.5" />
                            Deploy
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
