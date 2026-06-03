import { redirect } from "next/navigation"

import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"

export default async function PaymentsPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{
    lang: string
  }>
  searchParams: Promise<{
    tab?: string
  }>
}>) {
  const { lang } = await params
  const { tab } = await searchParams
  const locale = resolveLocaleOrDefault(lang)

  // If sub-page already set ?tab= via redirect, preserve it
  if (!tab) {
    redirect(localizePathname({ pathname: "/portal/payments/overview", locale }))
  }
}
