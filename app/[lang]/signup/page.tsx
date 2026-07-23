import { redirect } from "next/navigation"
import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"

const getSafeNext = (next: string | undefined, fallbackPath: string) => {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return fallbackPath
  }

  return next
}

type SignupPageProps = {
  params: Promise<{
    lang: string
  }>
  searchParams?: Promise<{
    next?: string
  }>
}

export default async function SignupPage({
  searchParams,
  params,
}: SignupPageProps) {
  const { lang } = await params
  const locale = resolveLocaleOrDefault(lang)
  const search = await searchParams
  const startPath = localizePathname({ pathname: "/login/start", locale })
  const next = getSafeNext(
    search?.next,
    localizePathname({ pathname: "/console", locale })
  )
  const redirectParams = new URLSearchParams({ intent: "signup", next })
  redirect(`${startPath}?${redirectParams.toString()}`)
}
