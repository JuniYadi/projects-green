"use client"

import { useRouter } from "next/navigation"
import { Plus } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useTemplates } from "@/modules/whatsapp/templates/api/templates.hooks"
import { TemplateList } from "@/modules/whatsapp/templates/ui/template-list"

export default function PortalTemplatesPage() {
  const router = useRouter()
  const { templates, loading, error, reload } = useTemplates()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Templates</h1>
        <p className="text-muted-foreground">
          View and manage your WhatsApp message templates.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Message Templates</CardTitle>
            <CardDescription>
              Your WhatsApp message templates
            </CardDescription>
          </div>
          <Button onClick={() => router.push("./new")}>
            <Plus weight="bold" className="mr-2 size-4" />
            Create Template
          </Button>
        </CardHeader>
        <CardContent>
          <TemplateList
            templates={templates}
            loading={loading}
            error={error}
            onRetry={() => void reload()}
            onCreate={() => router.push("./new")}
            onSelect={(id) => router.push(`./${id}`)}
          />
        </CardContent>
      </Card>
    </div>
  )
}
