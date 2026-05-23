import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { withAuth } from "@workos-inc/authkit-nextjs"
import { redirect } from "next/navigation"

export default async function PortalPage({
  params,
}: Readonly<{
  params: Promise<{
    lang: string
  }>
}>) {
  const { lang } = await params
  const locale = resolveLocaleOrDefault(lang)

  // Redirect to first available section
  const supportTicketsPath = localizePathname({
    pathname: "/portal/support-tickets",
    locale,
  })

  redirect(supportTicketsPath)
}