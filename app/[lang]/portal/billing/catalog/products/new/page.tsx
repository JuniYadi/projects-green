"use client"

import { useSearchParams } from "next/navigation"

import { ProductEditor } from "@/components/billing/admin/catalog/product-editor"
import { PRODUCT_OPTIONS } from "@/components/billing/admin/catalog/catalog-editor.types"

export default function NewProductEditorPage() {
  const searchParams = useSearchParams()
  const requestedCode = searchParams.get("code")?.toUpperCase()
  const productCode = PRODUCT_OPTIONS.some(
    (option) => option.value === requestedCode
  )
    ? requestedCode!
    : PRODUCT_OPTIONS[0].value

  return <ProductEditor productCode={productCode} isNew />
}
