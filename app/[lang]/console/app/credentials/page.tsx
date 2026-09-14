import type { Metadata } from "next"
import { Suspense } from "react"

import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import CredentialsPageClient from "./page-client"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>
}): Promise<Metadata> {
  const locale = resolveLocaleOrDefault((await params).lang)
  return { title: getMessages(locale).console.app.credentials.heading }
}

export default function CredentialsPage() {
  return (
    <Suspense>
      <CredentialsPageClient />
    </Suspense>
  )
}
