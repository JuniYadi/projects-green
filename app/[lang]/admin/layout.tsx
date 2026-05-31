import { AppSidebar } from "@/components/app-sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
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

export default async function AdminLayout({
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
  const adminPath = localizePathname({
    pathname: "/admin",
    locale,
  })

  if (!auth.organizationId) {
    const onboardingPath = localizePathname({
      pathname: ONBOARDING_PATH,
      locale,
    })

    redirect(`${onboardingPath}?next=${encodeURIComponent(adminPath)}`)
  }

  const workosUser = await getLatestWorkOSUser(auth.user)
  const sidebarUser = resolveSidebarUser(workosUser)
  const sidebarOrganization = await resolveSidebarOrganization(
    auth.organizationId,
  )

  return (
    <SidebarProvider>
      <AppSidebar
        surface="admin"
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
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href={adminPath}>
                    Admin
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>Workspace</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
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
