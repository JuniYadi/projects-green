import { notFound } from "next/navigation"

import { IndonesianLocaleControl } from "@/components/indonesian-locale-control"
import { getMessages } from "@/lib/i18n/messages"
import { isLocale } from "@/lib/i18n/pathname"

type LocaleLayoutProps = {
  children: React.ReactNode
  params: Promise<{
    lang: string
  }>
}

export default async function LocaleLayout({
  children,
  params,
}: LocaleLayoutProps) {
  const { lang } = await params

  if (!isLocale(lang)) {
    notFound()
  }

  const messages = getMessages(lang)

  return (
    <>
      {children}
      <IndonesianLocaleControl
        locale={lang}
        messages={messages.indonesianLocale}
      />
    </>
  )
}
