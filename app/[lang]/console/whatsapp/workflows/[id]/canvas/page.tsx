import { redirect } from "next/navigation"

type PageProps = {
  params: Promise<{ lang: string; id: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function WhatsappWorkflowCanvasRedirectPage({
  params,
  searchParams,
}: PageProps) {
  const { lang = "en", id } = await params
  const resolvedSearchParams = (await searchParams) || {}
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(resolvedSearchParams)) {
    if (typeof value === "string") {
      query.set(key, value)
    } else if (Array.isArray(value)) {
      for (const v of value) {
        query.append(key, v)
      }
    }
  }
  const queryString = query.toString()
  const destination =
    `/${lang}/console/ai/agents/${id}/canvas` +
    (queryString ? `?${queryString}` : "")
  redirect(destination)
}
