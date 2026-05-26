import { redirect } from "next/navigation"

type WhatsAppPageProps = {
  params: Promise<{
    lang: string
  }>
}

export default async function WhatsAppPage({ params }: WhatsAppPageProps) {
  const { lang } = await params
  redirect(`/${lang}/console/whatsapp/dashboard`)
}
