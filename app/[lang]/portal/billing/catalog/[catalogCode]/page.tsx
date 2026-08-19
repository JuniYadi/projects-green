import { redirect } from "next/navigation"

export default async function CatalogCodeRoute({
  params,
}: {
  params: Promise<{ lang: string; catalogCode: string }>
}) {
  const { lang, catalogCode } = await params
  redirect(
    `/${lang}/portal/billing/catalog/${catalogCode.toLowerCase()}/products`
  )
}
