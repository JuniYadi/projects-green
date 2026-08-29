import "./console.css"

import { AppSidebar } from "@/components/app-sidebar"
import { AppBreadcrumbs } from "@/components/app-breadcrumbs"
import { Separator } from "@/components/ui/separator"
import { ConsoleOnboardingTour } from "@/components/console-onboarding-tour"
import { CompactBalanceBadge } from "@/components/billing/compact-balance-badge"
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
import { getMessages } from "@/lib/i18n/messages"
import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { ThunderAiHelpDrawer } from "@/modules/docs/ui/thunder-ai-help-drawer"
import { withAuth } from "@workos-inc/authkit-nextjs"
import { redirect } from "next/navigation"
import { getPlatformAccessForUser } from "@/lib/platform-role"
import { getWorkOS } from "@workos-inc/authkit-nextjs"
import { ensureBillingAccountForOrg } from "@/modules/billing/billing-account.service"
import { MINIMUM_BALANCE_WARN_IDR } from "@/modules/billing/constants"
import { BillingBalanceGateBanner } from "@/components/billing-balance-gate-banner"
import { formatBillingMoney } from "@/modules/billing/format-money"
import { headers } from "next/headers"
import { readFunctionalTestIdentity } from "@/lib/auth/functional-test-session"
import { resolveFirstActiveOrganization } from "@/lib/whatsapp/resolvers"

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
  const messages = getMessages(locale)
  const functionalIdentity = readFunctionalTestIdentity(await headers())
  const auth = functionalIdentity ?? (await withAuth({ ensureSignedIn: true }))
  const consolePath = localizePathname({ pathname: "/console", locale })
  const portalPath = localizePathname({ pathname: "/portal", locale })
  let activeOrgId = auth.organizationId

  if (!activeOrgId && !functionalIdentity) {
    const fallbackOrg = await resolveFirstActiveOrganization(auth.user.id)
    if (fallbackOrg?.organizationId) {
      activeOrgId = fallbackOrg.organizationId
    }
  }

  if (!activeOrgId) {
    const onboardingPath = localizePathname({
      pathname: ONBOARDING_PATH,
      locale,
    })

    redirect(`${onboardingPath}?next=${encodeURIComponent(consolePath)}`)
  }

  const platformAccess = functionalIdentity
    ? { exists: false, role: "none" as const }
    : await getPlatformAccessForUser({
        id: auth.user.id,
        email: auth.user.email,
      })

  if (platformAccess.exists) {
    redirect(portalPath)
  }

  const sidebarUser = functionalIdentity
    ? {
        name: "Functional User",
        email: functionalIdentity.user.email,
        avatarUrl: null,
      }
    : resolveSidebarUser(await getLatestWorkOSUser(auth.user))
  const sidebarOrganization = functionalIdentity
    ? { id: activeOrgId, name: "Functional Test Organization" }
    : await resolveSidebarOrganization(activeOrgId)

  // JIT guarantee: every org reaching the console has a billing account, so the
  // "missing account" state is impossible by the time a purchase is attempted.
  // Best-effort — never block console access if WorkOS lookup or the DB write
  // transiently fails; the purchase flow still returns a clean 402 in that case.
  let balanceGate: { formattedBalance: string; isZero: boolean } | null = null
  if (!functionalIdentity) {
    try {
      const account = await ensureBillingAccountForOrg({
        organizationId: activeOrgId,
        getOrganizationAction: (orgId) =>
          getWorkOS().organizations.getOrganization(orgId),
      })
      if (account.balance.lt(MINIMUM_BALANCE_WARN_IDR)) {
        // Single source of truth: `currency` (see CURRENCY-FIX-STRATEGY).
        const currency = account.currency
        balanceGate = {
          formattedBalance: formatBillingMoney(
            account.balance.toFixed(2),
            currency
          ),
          isZero: account.balance.lte(0),
        }
      }
    } catch (error) {
      console.error("[ConsoleLayout] ensureBillingAccount failed", {
        organizationId: activeOrgId,
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  const topupPath = localizePathname({
    pathname: "/console/billing/topup",
    locale,
  })

  return (
    <SidebarProvider className="h-svh">
      <AppSidebar
        surface="console"
        user={sidebarUser}
        organization={sidebarOrganization}
        collapsible="icon"
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
          <div className="ml-auto flex items-center gap-3 px-6">
            <CompactBalanceBadge lang={locale} />
            <ThunderAiHelpDrawer />
          </div>
        </header>
        {balanceGate ? (
          <BillingBalanceGateBanner
            formattedBalance={balanceGate.formattedBalance}
            topupUrl={topupPath}
            isZero={balanceGate.isZero}
            messages={messages.console.billing.balanceGate}
            lang={locale}
          />
        ) : null}
        {children}
      </SidebarInset>
      <ConsoleOnboardingTour />
    </SidebarProvider>
  )
}
