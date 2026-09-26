import { redirect } from "next/navigation"

export default async function ConsoleAiPage({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  redirect(`/${lang}/console/ai/agents`)
}
