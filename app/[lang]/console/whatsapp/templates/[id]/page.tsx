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
  type TemplateFormInput,
} from "@/modules/whatsapp/templates/api/templates.hooks"
import { TemplateForm, type LanguageVariant } from "@/modules/whatsapp/templates/ui/template-form"
import { TemplateDeleteDialog } from "@/modules/whatsapp/templates/ui/template-delete-dialog"
import { TemplateDetailView } from "@/modules/whatsapp/templates/ui/template-detail"

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

  const approvedTemplateLocked = template?.metaStatus === "APPROVED"
  const lockedVariantIds =
    template?.languages
      .filter((l) => l.isApproved || l.metaStatus === "APPROVED")
      .map((l) => l.id) ?? []
  const structureSource =
    template?.languages.find(
      (l) => l.isApproved || l.metaStatus === "APPROVED"
    ) ?? template?.languages[0] ?? null
  const structureTemplate = structureSource
    ? {
        headerType: structureSource.headerType ?? "NONE",
        headerText: structureSource.headerText ?? "",
        headerUrl: structureSource.headerUrl ?? "",
        body: structureSource.body ?? "",
        footer: structureSource.footer ?? "",
        parameters: structureSource.parameters,
        buttons: structureSource.buttons,
      }
    : null

  const handleUpdate = async (data: {
    name: string
    slug: string
    description?: string
    category?: string
    languages: Omit<LanguageVariant, "id">[]
  }) => {
    try {
      await update(id, data as Partial<TemplateFormInput>)
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
              {approvedTemplateLocked
                ? "Approved templates are locked. Add a new language variant with the same content structure."
                : "Update the template details and language variants"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TemplateForm
              initialData={{
                name: template.name,
                slug: template.slug,
                description: template.description,
                category: template.category,
                languages: template.languages.map((l) => ({
                  id: l.id,
                  lang: l.lang,
                  headerType: l.headerType ?? "NONE",
                  headerText: l.headerText ?? "",
                  headerUrl: l.headerUrl ?? "",
                  body: l.body ?? "",
                  footer: l.footer ?? "",
                  parameters: l.parameters,
                  buttons: l.buttons,
                })),
              }}
              submitting={updating}
              onSubmit={handleUpdate}
              mode="edit"
              approvedTemplateLocked={approvedTemplateLocked}
              lockedVariantIds={lockedVariantIds}
              structureTemplate={structureTemplate}
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
