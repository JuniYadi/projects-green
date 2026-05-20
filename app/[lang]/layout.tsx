import { notFound } from "next/navigation"

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

  return children
}
