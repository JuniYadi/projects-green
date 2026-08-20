import { type AppLocale } from "@/lib/i18n/config"
import { getMessages } from "@/lib/i18n/messages"
import { ShieldCheck, CalendarBlank } from "@phosphor-icons/react"

interface LegalDocumentViewProps {
  locale: AppLocale
  docKey: "terms" | "privacy" | "acceptableUse"
}

export function LegalDocumentView({ locale, docKey }: LegalDocumentViewProps) {
  const messages = getMessages(locale)
  const legal = messages.legal
  const doc = legal[docKey]

  return (
    <article className="prose max-w-none dark:prose-invert">
      {/* Header */}
      <header className="mb-8 border-b border-border/80 pb-8">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>Official Legal Policy</span>
        </div>
        <h1 className="mb-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {doc.title}
        </h1>
        <p className="text-base leading-relaxed text-muted-foreground">
          {doc.intro}
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-4 text-xs text-muted-foreground sm:gap-6">
          <div className="flex items-center gap-1.5">
            <CalendarBlank className="h-4 w-4 text-muted-foreground" />
            <span>
              <strong>{legal.effectiveDateLabel}:</strong> {legal.effectiveDate}
            </span>
          </div>
          <div className="hidden h-3 w-px bg-border sm:block" />
          <div>
            <strong>Legal Entity:</strong> {legal.companyName}
          </div>
        </div>
      </header>

      {/* Sections */}
      <div className="space-y-8">
        {doc.sections.map((section, idx) => (
          <section key={idx} className="space-y-3">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              {section.title}
            </h2>
            {section.content.map((paragraph, pIdx) => (
              <p
                key={pIdx}
                className="text-sm leading-relaxed text-muted-foreground"
              >
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </div>
    </article>
  )
}
