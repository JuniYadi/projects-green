import { withAuth } from "@workos-inc/authkit-nextjs"
import { redirect } from "next/navigation"

const ONBOARDING_PATH = "/onboarding/organization"

export default async function ConsoleLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const auth = await withAuth({ ensureSignedIn: true })

  if (!auth.organizationId) {
    redirect(`${ONBOARDING_PATH}?next=${encodeURIComponent("/console")}`)
  }

  return <>{children}</>
}
