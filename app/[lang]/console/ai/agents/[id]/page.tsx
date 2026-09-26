import { redirect } from "next/navigation"

export default async function ConsoleAiAgentDetailPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>
}) {
  const { lang, id } = await params
  redirect(`/${lang}/console/ai/agents/${id}/canvas`)
}
