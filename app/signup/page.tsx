import { SignupForm } from "@/components/signup-form"

const getSafeNext = (next: string | undefined) => {
  if (!next || !next.startsWith("/")) {
    return "/"
  }

  return next
}

type SignupPageProps = {
  searchParams?: Promise<{
    next?: string
  }>
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const params = await searchParams
  const next = getSafeNext(params?.next)

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6 md:p-10">
      <div className="w-full max-w-md lg:max-w-lg">
        <SignupForm nextPath={next} />
      </div>
    </div>
  )
}
