"use client"

import { useRouter } from "next/navigation"
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
import { useCreateTemplate } from "@/modules/whatsapp/templates/api/templates.hooks"
import { TemplateForm } from "@/modules/whatsapp/templates/ui/template-form"

export default function PortalNewTemplatePage() {
  const router = useRouter()
  const { create, creating } = useCreateTemplate()

  const handleSubmit = async (data: {
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
      const template = await create(data)
      toast.success("Template created successfully.")
      router.push(`./${template.id}`)
    } catch {
      toast.error("Failed to create template.")
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="w-fit px-0">
          <Link href="./">
            <ArrowLeft className="mr-1 size-4" />
            Back to Templates
          </Link>
        </Button>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          Create Template
        </h1>
        <p className="text-muted-foreground">
          Create a new WhatsApp message template
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Template Details</CardTitle>
          <CardDescription>
            Fill in the template details and language variants
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TemplateForm submitting={creating} onSubmit={handleSubmit} />
        </CardContent>
      </Card>
    </div>
  )
}
