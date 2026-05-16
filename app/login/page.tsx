import { LoginForm } from "@/components/login-form"

const getSafeNext = (next: string | undefined) => {
  if (!next || !next.startsWith("/")) {
    return "/"
  }

  return next
}

type LoginPageProps = {
  searchParams?: Promise<{
    next?: string
  }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams
  const next = getSafeNext(params?.next)

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
