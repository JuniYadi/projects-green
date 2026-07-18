import { redirect } from "next/navigation"

type PageProps = {
  params: Promise<{ lang: string; orgId: string }>
  searchParams: Promise<{ tab?: string }>
}

export default async function OrgBillingRedirect({
  params,
  searchParams,
}: PageProps) {
  const { lang, orgId } = await params
  const { tab } = await searchParams
  const page = tab ?? "billing"
  redirect(`/${lang}/portal/orgs/${orgId}?page=${page}`)
}
