import { redirect } from "next/navigation"
import { localizePathname } from "@/lib/i18n/pathname"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"

type PortalManagePageProps = {
  params: Promise<{ lang: string }>
}

export default async function PortalManagePage({
  params,
}: PortalManagePageProps) {
  const { lang } = await params
  const locale = resolveLocaleOrDefault(lang)
  redirect(localizePathname({ pathname: "/portal/app", locale }))
}
