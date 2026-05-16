import { VerifyEmailForm } from "@/components/verify-email-form"

const getSafeNext = (next: string | undefined) => {
  if (!next || !next.startsWith("/")) {
    return "/"
  }

  return next
}

type VerifyEmailPageProps = {
  searchParams?: Promise<{
    email?: string
    next?: string
    pendingAuthenticationToken?: string
  }>
}

export default async function VerifyEmailPage({
  searchParams,
}: VerifyEmailPageProps) {
  const params = await searchParams
  const next = getSafeNext(params?.next)
  const email = params?.email
  const pendingAuthenticationToken = params?.pendingAuthenticationToken ?? ""

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
