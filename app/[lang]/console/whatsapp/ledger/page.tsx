import { redirect } from "next/navigation"
import { resolveLocaleOrDefault, localizePathname } from "@/lib/i18n/pathname"

export default async function WhatsappLedgerRedirectPage(props: {
  params: Promise<{ lang?: string }>
}) {
  const params = await props.params
  const locale = resolveLocaleOrDefault(params?.lang)
  redirect(
    localizePathname({
      pathname: "/console/whatsapp/pricing",
      locale,
    })
  )
}
