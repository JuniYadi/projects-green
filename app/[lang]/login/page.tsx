import { AuthPageShell } from "@/components/auth-page-shell"
import { LoginForm } from "@/components/login-form"
import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"

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
  const search = await searchParams
  const next = getSafeNext(
    search?.next,
    localizePathname({ pathname: "/console", locale })
  )

  return (
    <AuthPageShell
      badge="Console access"
      panelTitle="Continue to PFNApp"
      panelDescription="Sign in to manage the PFNApp console, or create a WorkOS account from this page if you are new."
    >
      <LoginForm nextPath={next} errorMessage={search?.error} />
    </AuthPageShell>
  )
}
