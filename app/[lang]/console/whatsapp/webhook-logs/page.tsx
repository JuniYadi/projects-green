"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { resolveLocaleOrDefault, localizePathname } from "@/lib/i18n/pathname"

export default function RedirectToWebhookLogsTab() {
  const params = useParams<{ lang?: string }>()
  const router = useRouter()
  const locale = resolveLocaleOrDefault(params?.lang)

  React.useEffect(() => {
    const target = localizePathname({
      pathname: "/console/whatsapp/logs",
      locale,
    })
    router.replace(target)
  }, [locale, router])

  return null
}
