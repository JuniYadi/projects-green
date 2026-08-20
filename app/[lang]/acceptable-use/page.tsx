import type { Metadata } from "next"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { getMessages } from "@/lib/i18n/messages"
import { LegalPageLayout } from "@/components/legal/legal-page-layout"
import { LegalDocumentView } from "@/components/legal/legal-document-view"

interface AcceptableUsePageProps {
  params: Promise<{ lang?: string }>
}

export async function generateMetadata({
  params,
}: AcceptableUsePageProps): Promise<Metadata> {
  const { lang } = await params
  const locale = resolveLocaleOrDefault(lang)
  const messages = getMessages(locale)

  return {
    title: `${messages.legal.acceptableUse.title} — PFNApp`,
    description: messages.legal.acceptableUse.description,
    openGraph: {
      title: `${messages.legal.acceptableUse.title} — PFNApp`,
      description: messages.legal.acceptableUse.description,
      type: "website",
    },
  }
}

export default async function AcceptableUsePage({
  params,
}: AcceptableUsePageProps) {
  const { lang } = await params
  const locale = resolveLocaleOrDefault(lang)

  return (
    <LegalPageLayout locale={locale} activeDoc="acceptable-use">
      <LegalDocumentView locale={locale} docKey="acceptable-use" />
    </LegalPageLayout>
  )
}
