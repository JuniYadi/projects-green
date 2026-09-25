"use client"

import { useParams, useSearchParams } from "next/navigation"
import { GitDeployWizard } from "@/modules/deploy/ui/git-deploy/git-deploy-wizard"
import { TemplateDeployView } from "@/modules/deploy/ui/template-deploy/template-deploy-view"

type DeployPageClientProps = {
  initialUserName?: string
  lang?: string
}

export default function DeployPageClient({
  initialUserName,
  lang: propLang,
}: DeployPageClientProps = {}) {
  const params = useParams()
  const searchParams = useSearchParams()
  const lang = propLang || (params?.lang as string) || "en"
  const templateSlug = searchParams.get("template")

  if (templateSlug) {
    return <TemplateDeployView templateSlug={templateSlug} lang={lang} />
  }

  return <GitDeployWizard initialUserName={initialUserName} lang={lang} />
}
