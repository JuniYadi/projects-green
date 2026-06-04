import { AppSidebar } from "@/components/app-sidebar"
import { AppBreadcrumbs } from "@/components/app-breadcrumbs"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import {
  getLatestWorkOSUser,
  resolveSidebarOrganization,
  resolveSidebarUser,
} from "@/lib/sidebar-session"
import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { ThunderAiHelpDrawer } from "@/modules/docs/ui/thunder-ai-help-drawer"
import { withAuth } from "@workos-inc/authkit-nextjs"
import { redirect } from "next/navigation"

const ONBOARDING_PATH = "/onboarding/organization"

export default async function ConsoleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode
  params: Promise<{
    lang: string
  }>
}>) {
  const { lang } = await params
  const locale = resolveLocaleOrDefault(lang)
  const auth = await withAuth({ ensureSignedIn: true })
  const consolePath = localizePathname({ pathname: "/console", locale })

  if (!auth.organizationId) {
    const onboardingPath = localizePathname({
      pathname: ONBOARDING_PATH,
      locale,
    })

    redirect(`${onboardingPath}?next=${encodeURIComponent(consolePath)}`)
  }

  const workosUser = await getLatestWorkOSUser(auth.user)
  const sidebarUser = resolveSidebarUser(workosUser)
  const sidebarOrganization = await resolveSidebarOrganization(
    auth.organizationId
  )

  return (
    <SidebarProvider>
      <AppSidebar
        surface="console"
        user={sidebarUser}
        organization={sidebarOrganization}
      />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2">
          <div className="flex items-center gap-2 px-6">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-vertical:h-4 data-vertical:self-auto"
            />
            <AppBreadcrumbs rootSegment="console" />
          </div>
          <div className="ml-auto px-6">
            <ThunderAiHelpDrawer />
          </div>
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  )
}
