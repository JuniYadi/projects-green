import { withAuth } from "@workos-inc/authkit-nextjs"
import { redirect } from "next/navigation"
import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { getPlatformRoleForUser } from "@/lib/platform-role"

export default async function AdminLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode
  params: Promise<{ lang: string }>
}>) {
  const { lang } = await params
  const locale = resolveLocaleOrDefault(lang)
  const auth = await withAuth({ ensureSignedIn: true })

  const platformRole = await getPlatformRoleForUser({
    id: auth.user.id,
    email: auth.user.email,
  })

  if (platformRole !== "super_admin") {
    redirect(localizePathname({ pathname: "/portal", locale }))
  }

  return <>{children}</>
}
