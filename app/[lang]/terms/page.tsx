import type { Metadata } from "next"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { getMessages } from "@/lib/i18n/messages"
import { LegalPageLayout } from "@/components/legal/legal-page-layout"
import { LegalDocumentView } from "@/components/legal/legal-document-view"

interface TermsPageProps {
  params: Promise<{ lang?: string }>
}

export async function generateMetadata({
  params,
}: TermsPageProps): Promise<Metadata> {
  const { lang } = await params
  const locale = resolveLocaleOrDefault(lang)
  const messages = getMessages(locale)

  return {
    title: `${messages.legal.terms.title} — PFNApp`,
    description: messages.legal.terms.description,
    openGraph: {
      title: `${messages.legal.terms.title} — PFNApp`,
      description: messages.legal.terms.description,
      type: "website",
    },
  }
}

export default async function TermsPage({ params }: TermsPageProps) {
  const { lang } = await params
  const locale = resolveLocaleOrDefault(lang)

  return (
    <LegalPageLayout locale={locale} activeDoc="terms">
      <LegalDocumentView locale={locale} docKey="terms" />
    </LegalPageLayout>
  )
}
