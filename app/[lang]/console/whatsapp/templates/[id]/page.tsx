"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "@phosphor-icons/react"
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
  useTemplate,
  useUpdateTemplate,
  useDeleteTemplate,
  useSyncTemplate,
} from "@/modules/whatsapp/templates/api/templates.hooks"
import { TemplateDetailView } from "@/modules/whatsapp/templates/ui/template-detail"
import { TemplateForm } from "@/modules/whatsapp/templates/ui/template-form"
import { TemplateDeleteDialog } from "@/modules/whatsapp/templates/ui/template-delete-dialog"

export default function ConsoleTemplateDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const { template, loading, error, reload } = useTemplate(id)
  const { update, updating } = useUpdateTemplate()
  const { remove, deleting } = useDeleteTemplate()
  const { sync, syncing } = useSyncTemplate()

  const [editing, setEditing] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)

  const handleUpdate = async (data: {
    name: string
    slug: string
    description?: string
    languages: Array<{
      lang: string
      headerType: string
      headerText: string
      body: string
      footer: string
    }>
  }) => {
    try {
      await update(id, data)
      toast.success("Template updated successfully.")
      setEditing(false)
      void reload()
    } catch {
      toast.error("Failed to update template.")
    }
  }

  const handleDelete = async () => {
    try {
      await remove(id)
      toast.success("Template deleted successfully.")
      router.push("../")
    } catch {
      toast.error("Failed to delete template.")
    }
  }

  const handleSync = async () => {
    try {
      await sync(id)
      toast.success("Sync job enqueued.")
    } catch {
      toast.error("Failed to sync template.")
    }
  }

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="w-fit px-0">
        <Link href="../">
          <ArrowLeft className="mr-1 size-4" />
          Back to Templates
        </Link>
      </Button>

      {editing && template ? (
        <Card>
          <CardHeader>
            <CardTitle>Edit Template</CardTitle>
            <CardDescription>
              Update the template details and language variants
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TemplateForm
              initialData={{
                name: template.name,
                slug: template.slug,
                description: template.description,
                languages: template.languages.map((l) => ({
                  id: l.id,
                  lang: l.lang,
                  headerType: l.headerType ?? "NONE",
                  headerText: l.headerText ?? "",
                  headerUrl: l.headerUrl ?? "",
                  body: l.body ?? "",
                  footer: l.footer ?? "",
                })),
              }}
              submitting={updating}
              onSubmit={handleUpdate}
            />
          </CardContent>
        </Card>
      ) : (
        <TemplateDetailView
          template={template}
          loading={loading}
          error={error}
          onRetry={() => void reload()}
          onEdit={() => setEditing(true)}
          onDelete={() => setDeleteOpen(true)}
          onSync={template?.whatsappDeviceId ? handleSync : undefined}
          syncing={syncing}
        />
      )}

      <TemplateDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        templateName={template?.name ?? "this template"}
        deleting={deleting}
        onConfirm={() => void handleDelete()}
      />
    </div>
  )
}
