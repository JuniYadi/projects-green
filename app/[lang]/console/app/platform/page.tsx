import { redirect } from "next/navigation"

export default async function ConsoleAppPlatformPage({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  redirect(`/${lang}/console/app/platforms`)
}
