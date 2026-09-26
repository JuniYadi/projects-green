import { redirect } from "next/navigation"

export default async function ConsoleWhatsAppWorkflowDetailPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>
}) {
  const { lang, id } = await params
  redirect(`/${lang}/console/whatsapp/workflows/${id}/canvas`)
}
