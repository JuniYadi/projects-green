import { redirect } from "next/navigation"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"

export default async function NewCredentialPage({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  const locale = resolveLocaleOrDefault(lang)
  redirect(`/${locale}/console/app/credentials?action=new`)
}
