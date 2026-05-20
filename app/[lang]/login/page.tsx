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
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div className="flex w-full max-w-md lg:max-w-lg flex-col gap-6">
        <a href="#" className="flex items-center gap-2 self-center font-medium">
          <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <span className="text-xs">A</span>
          </div>
          Acme Inc.
        </a>
        <LoginForm nextPath={next} />
      </div>
    </div>
  )
}
