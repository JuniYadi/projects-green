import type { Metadata } from "next"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { getMessages } from "@/lib/i18n/messages"
import { LegalPageLayout } from "@/components/legal/legal-page-layout"
import { LegalDocumentView } from "@/components/legal/legal-document-view"

interface PrivacyPageProps {
  params: Promise<{ lang?: string }>
}

export async function generateMetadata({
  params,
}: PrivacyPageProps): Promise<Metadata> {
  const { lang } = await params
  const locale = resolveLocaleOrDefault(lang)
  const messages = getMessages(locale)

  return {
    title: `${messages.legal.privacy.title} — PFNApp`,
    description: messages.legal.privacy.description,
    openGraph: {
      title: `${messages.legal.privacy.title} — PFNApp`,
      description: messages.legal.privacy.description,
      type: "website",
    },
  }
}

export default async function PrivacyPage({ params }: PrivacyPageProps) {
  const { lang } = await params
  const locale = resolveLocaleOrDefault(lang)

  return (
    <LegalPageLayout locale={locale} activeDoc="privacy">
      <LegalDocumentView locale={locale} docKey="privacy" />
    </LegalPageLayout>
  )
}
