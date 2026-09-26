import { redirect } from "next/navigation"

export default async function AdminWhatsAppPage({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  redirect(`/${lang}/portal/whatsapp/devices`)
}
