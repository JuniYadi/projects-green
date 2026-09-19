import type { Metadata } from "next"
import { AuthPageShell } from "@/components/auth-page-shell"
import { LoginForm } from "@/components/login-form"
import { getMessages } from "@/lib/i18n/messages"
import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"

export const metadata: Metadata = {
  title: "Sign in or create an account",
  description: "Sign in to or create your PFNApp account.",
}

const getSafeNext = (next: string | undefined, fallbackPath: string) => {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return fallbackPath
  }

  return next
}

type LoginPageProps = {
  params: Promise<{
    lang: string
  }>
  searchParams?: Promise<{
    next?: string
    error?: string
  }>
}

export default async function LoginPage({
  searchParams,
  params,
}: LoginPageProps) {
  const { lang } = await params
  const locale = resolveLocaleOrDefault(lang)
  const messages = getMessages(locale).pAuthPages.login
  const search = await searchParams
  const next = getSafeNext(
    search?.next,
    localizePathname({ pathname: "/console", locale })
  )

  return (
    <AuthPageShell
      badge={messages.badge}
      panelTitle={messages.panelTitle}
      panelDescription={messages.panelDescription}
    >
      <LoginForm nextPath={next} errorMessage={search?.error} />
    </AuthPageShell>
  )
}
