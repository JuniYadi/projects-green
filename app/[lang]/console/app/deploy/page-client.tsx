"use client"

import { useParams } from "next/navigation"
import { GitDeployWizard } from "@/modules/deploy/ui/git-deploy/git-deploy-wizard"

type DeployPageClientProps = {
  initialUserName?: string
  lang?: string
}

export default function DeployPageClient({
  initialUserName,
  lang: propLang,
}: DeployPageClientProps = {}) {
  const params = useParams()
  const lang = propLang || (params?.lang as string) || "en"
  return <GitDeployWizard initialUserName={initialUserName} lang={lang} />
}
