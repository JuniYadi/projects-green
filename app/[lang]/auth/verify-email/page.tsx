import { VerifyEmailForm } from "@/components/verify-email-form"
import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"

const getSafeNext = (next: string | undefined, fallbackPath: string) => {
  if (!next || !next.startsWith("/")) {
    return fallbackPath
  }

  return next
}

type VerifyEmailPageProps = {
  params: Promise<{
    lang: string
  }>
  searchParams?: Promise<{
    email?: string
    next?: string
    pendingAuthenticationToken?: string
  }>
}

export default async function VerifyEmailPage({
  searchParams,
  params,
}: VerifyEmailPageProps) {
  const { lang } = await params
  const locale = resolveLocaleOrDefault(lang)
  const search = await searchParams
  const next = getSafeNext(
    search?.next,
    localizePathname({ pathname: "/", locale })
  )
  const email = search?.email
  const pendingAuthenticationToken = search?.pendingAuthenticationToken ?? ""

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div className="w-full max-w-md lg:max-w-lg">
        <VerifyEmailForm
          email={email}
          nextPath={next}
          pendingAuthenticationToken={pendingAuthenticationToken}
        />
      </div>
    </div>
  )
}
