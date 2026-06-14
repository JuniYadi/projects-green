import { SelectOrganizationForm } from "@/components/select-organization-form"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"

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
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div className="w-full max-w-md lg:max-w-lg">
        <SelectOrganizationForm
          email={email}
          organizations={organizations}
          pendingAuthenticationToken={pendingAuthenticationToken}
        />
      </div>
    </div>
  )
}
