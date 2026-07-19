import { AuthPageShell } from "@/components/auth-page-shell"

import { SelectOrganizationForm } from "@/components/select-organization-form"

type SelectOrganizationPageProps = {
  params: Promise<{
    lang: string
  }>
  searchParams?: Promise<{
    email?: string
    pendingAuthenticationToken?: string
    organizations?: string
  }>
}

export default async function SelectOrganizationPage({
  searchParams,
  params,
}: SelectOrganizationPageProps) {
  // ponytail: lang unused but kept for type compliance with Next.js params
  void (await params)
  const search = await searchParams
  const pendingAuthenticationToken = search?.pendingAuthenticationToken ?? ""
  const email = search?.email

  // Parse organizations from JSON string passed by callback handler
  let organizations: Array<{ id: string; name: string }> = []
  if (search?.organizations) {
    try {
      const parsed = JSON.parse(search.organizations)
      if (Array.isArray(parsed)) {
        organizations = parsed
      }
    } catch {
      // Invalid JSON — silently fall through to empty list
    }
  }

  return (
    <AuthPageShell
      badge="Organization access"
      panelTitle="Select your workspace"
      panelDescription="Select the PFNApp organization you want to manage before entering the console."
      className="lg:max-w-lg"
    >
      <SelectOrganizationForm
        email={email}
        organizations={organizations}
        pendingAuthenticationToken={pendingAuthenticationToken}
      />
    </AuthPageShell>
  )
}
