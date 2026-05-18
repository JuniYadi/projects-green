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
import { DashboardDocsDrawer } from "@/modules/docs/ui/dashboard-docs-drawer"
import { withAuth } from "@workos-inc/authkit-nextjs"
import { redirect } from "next/navigation"

const ONBOARDING_PATH = "/onboarding/organization"

export default async function PortalLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const auth = await withAuth({ ensureSignedIn: true })

  if (!auth.organizationId) {
    redirect(`${ONBOARDING_PATH}?next=${encodeURIComponent("/portal")}`)
  }

  const workosUser = await getLatestWorkOSUser(auth.user)
  const sidebarUser = resolveSidebarUser(workosUser)
  const sidebarOrganization = await resolveSidebarOrganization(auth.organizationId)

  return (
    <SidebarProvider>
      <AppSidebar
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
                  <BreadcrumbLink href="/portal/documentations">
                    Documentation
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>Registry</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <div className="ml-auto px-6">
            <DashboardDocsDrawer />
          </div>
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  )
}
