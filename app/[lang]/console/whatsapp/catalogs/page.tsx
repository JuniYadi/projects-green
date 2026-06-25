"use client"

import * as React from "react"
import {
  ShoppingBagOpen,
  Plus,
  Trash,
  DotsThreeVertical,
  ArrowClockwise,
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { useParams, useRouter } from "next/navigation"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { whatsappClient } from "@/lib/api/whatsapp-client"

type Catalog = {
  id: string
  name: string
  metaCatalogId: string
  deviceId?: string | null
  productCount?: number
  createdAt: string
}

export default function CatalogsPage() {
  const params = useParams<{ lang?: string }>()
  const router = useRouter()
  const locale = resolveLocaleOrDefault(params?.lang)
  const [catalogs, setCatalogs] = React.useState<Catalog[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [createOpen, setCreateOpen] = React.useState(false)
  const [createForm, setCreateForm] = React.useState({ name: "", metaCatalogId: "", deviceId: "" })
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const loadCatalogs = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await whatsappClient.catalogs.list()
      setCatalogs(res.data ?? [])
    } catch (err: any) {
      toast.error(err.message ?? "Failed to load catalogs")
    } finally {
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => { loadCatalogs() }, [loadCatalogs])

  const handleCreate = async () => {
    if (!createForm.name || !createForm.metaCatalogId) {
      toast.error("Name and Meta Catalog ID are required.")
      return
    }
    setIsSubmitting(true)
    try {
      const input: any = { name: createForm.name, metaCatalogId: createForm.metaCatalogId }
      if (createForm.deviceId) input.deviceId = createForm.deviceId
      await whatsappClient.catalogs.create(input)
      toast.success("Catalog created.")
      setCreateOpen(false)
      setCreateForm({ name: "", metaCatalogId: "", deviceId: "" })
      await loadCatalogs()
    } catch (err: any) {
      toast.error(err.message ?? "Failed to create catalog.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await whatsappClient.catalogs.delete(id)
      toast.success("Catalog deleted.")
      await loadCatalogs()
    } catch (err: any) {
      toast.error(err.message ?? "Failed to delete catalog.")
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Catalogs</h1>
          <p className="text-muted-foreground text-sm">
            Manage your Facebook Catalogs and sync products from Commerce Manager.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 size-4" />
          Add Catalog
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Catalogs</CardTitle>
          <CardDescription>{catalogs.length} catalog{catalogs.length !== 1 ? "s" : ""}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : catalogs.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <ShoppingBagOpen className="size-12 text-muted-foreground/40" />
              <p className="text-muted-foreground text-sm">No catalogs yet.</p>
            </div>
          ) : (
            <div className="divide-y">
              {catalogs.map((cat) => (
                <div
                  key={cat.id}
                  className="flex items-center justify-between py-3 cursor-pointer hover:bg-muted/40 px-2 -mx-2 rounded-sm"
                  onClick={() => router.push(`/${locale}/console/whatsapp/catalogs/${cat.id}`)}
                >
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="font-medium truncate">{cat.name}</span>
                    <span className="text-muted-foreground text-xs truncate">
                      Meta ID: {cat.metaCatalogId} &middot; {cat.productCount ?? 0} products
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <Badge variant="secondary" className="text-xs">
                      {cat.productCount ?? 0} products
                    </Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8">
                          <DotsThreeVertical className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => router.push(`/${locale}/console/whatsapp/catalogs/${cat.id}`)}>
                          View Products
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => handleDelete(cat.id)}
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

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Catalog</DialogTitle>
            <DialogDescription>
              Link a Facebook Commerce Manager catalog to your WhatsApp account.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Catalog Name</Label>
              <Input id="name" value={createForm.name} onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))} placeholder="My Store Catalog" />
            </div>
            <div>
              <Label htmlFor="metaCatalogId">Meta Catalog ID</Label>
              <Input id="metaCatalogId" value={createForm.metaCatalogId} onChange={(e) => setCreateForm((f) => ({ ...f, metaCatalogId: e.target.value }))} placeholder="123456789" />
            </div>
            <div>
              <Label htmlFor="deviceId">Device ID (optional)</Label>
              <Input id="deviceId" value={createForm.deviceId} onChange={(e) => setCreateForm((f) => ({ ...f, deviceId: e.target.value }))} placeholder="Leave empty to use default device" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Catalog"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
