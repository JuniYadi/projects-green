import type { Metadata } from "next"
import { withAuth } from "@workos-inc/authkit-nextjs"
import { getCachedUser } from "@/lib/workos-directory"
import DeployPageClient from "./page-client"

export const metadata: Metadata = { title: "Deploy Git Repository" }

export default async function DeployPage({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  let userName = "Developer"

  try {
    const auth = await withAuth()
    if (auth.user?.id) {
      const cached = await getCachedUser(auth.user.id)
      userName =
        auth.user.firstName ||
        cached?.name?.split(" ")[0] ||
        auth.user.name?.split(" ")[0] ||
        "Developer"
    }
  } catch {
    // Graceful fallback for unauthenticated preview or test runs
  }

  return <DeployPageClient initialUserName={userName} lang={lang} />
}
