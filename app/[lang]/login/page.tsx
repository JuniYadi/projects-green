import { AuthPageShell } from "@/components/auth-page-shell"
import { LoginForm } from "@/components/login-form"
import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"

const getSafeNext = (next: string | undefined, fallbackPath: string) => {
  if (!next || !next.startsWith("/")) {
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
    localizePathname({ pathname: "/", locale })
  )

  return (
    <AuthPageShell
      badge="Console access"
      panelTitle="Welcome back"
      panelDescription="Sign in to manage deployments, billing, support tickets, VPN services, and WhatsApp operations from the PFNApp console."
    >
      <LoginForm nextPath={next} errorMessage={search?.error} />
    </AuthPageShell>
  )
}
