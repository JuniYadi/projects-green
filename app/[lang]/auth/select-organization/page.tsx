import type { Metadata } from "next"
import { AuthPageShell } from "@/components/auth-page-shell"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"

import { SelectOrganizationForm } from "@/components/select-organization-form"

export const metadata: Metadata = {
  title: "Select your workspace",
}

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
  const { lang } = await params
  const locale = resolveLocaleOrDefault(lang)
  const messages = getMessages(locale).pAuthPages.selectOrganization
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
      badge={messages.badge}
      panelTitle={messages.panelTitle}
      panelDescription={messages.panelDescription}
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
