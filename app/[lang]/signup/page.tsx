import { SignupForm } from "@/components/signup-form"
import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"

const getSafeNext = (next: string | undefined, fallbackPath: string) => {
  if (!next || !next.startsWith("/")) {
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
  const next = getSafeNext(
    search?.next,
    localizePathname({ pathname: "/", locale })
  )

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6 md:p-10">
      <div className="w-full max-w-md lg:max-w-lg">
        <SignupForm nextPath={next} />
      </div>
    </div>
  )
}
