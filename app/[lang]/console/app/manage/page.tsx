import { redirect } from "next/navigation"
import { localizePathname } from "@/lib/i18n/pathname"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"

type ManagePageProps = {
  params: Promise<{ lang: string }>
}

export default async function ManagePage({ params }: ManagePageProps) {
  const { lang } = await params
  const locale = resolveLocaleOrDefault(lang)
  redirect(localizePathname({ pathname: "/console/app", locale }))
}
