import {
  AppSidebar,
  type AppSidebarOrganization,
  type AppSidebarUser,
} from "@/components/app-sidebar"
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
import { DashboardDocsDrawer } from "@/modules/docs/ui/dashboard-docs-drawer"
import { getWorkOS, withAuth } from "@workos-inc/authkit-nextjs"
import type { User } from "@workos-inc/node"

const normalizeAvatarUrl = (value: string | null) => {
  if (!value) {
    return null
  }

  const candidate = value.trim()
  return candidate || null
}

const resolveSidebarUser = (user: User): AppSidebarUser => {
  const firstName = user.firstName?.trim() ?? ""
  const lastName = user.lastName?.trim() ?? ""
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim()
  const email = user.email?.trim() ?? ""
  const emailLocalPart = email.split("@")[0]?.trim() ?? ""
  const name = fullName || emailLocalPart || "User"

  return {
    name,
    email,
    avatarUrl: normalizeAvatarUrl(user.profilePictureUrl),
  }
}

const getLatestWorkOSUser = async (user: User): Promise<User> => {
  try {
    return await getWorkOS().userManagement.getUser(user.id)
  } catch (error) {
    console.warn("[console] Failed to load latest WorkOS user profile for sidebar.", {
      userId: user.id,
      error,
    })
    return user
  }
}

const resolveSidebarOrganization = async (
  organizationId: string | undefined
): Promise<AppSidebarOrganization> => {
  const id = organizationId ?? null
  if (!id) {
    return {
      id: null,
      name: null,
    }
  }

  try {
    const organization = await getWorkOS().organizations.getOrganization(id)
    return {
      id,
      name: organization.name?.trim() || null,
    }
  } catch (error) {
    console.warn("[console] Failed to load WorkOS organization for sidebar.", {
      organizationId: id,
      error,
    })
    return {
      id,
      name: null,
    }
  }
}

export default async function Page() {
  const auth = await withAuth({ ensureSignedIn: true })
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
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-vertical:h-4 data-vertical:self-auto"
            />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="#">
                    Build Your Application
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>Data Fetching</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <div className="ml-auto px-4">
            <DashboardDocsDrawer />
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <div className="grid auto-rows-min gap-4 md:grid-cols-3">
            <div className="aspect-video rounded-xl bg-muted/50" />
            <div className="aspect-video rounded-xl bg-muted/50" />
            <div className="aspect-video rounded-xl bg-muted/50" />
          </div>
          <div className="min-h-screen flex-1 rounded-xl bg-muted/50 md:min-h-min" />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
