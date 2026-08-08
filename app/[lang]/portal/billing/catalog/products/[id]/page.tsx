"use client"

import { useParams } from "next/navigation"

import { ProductEditor } from "@/components/billing/admin/catalog/product-editor"

export default function ProductEditorRoute() {
  const { id } = useParams<{ id: string }>()

  return <ProductEditor productCode={id.toUpperCase()} isNew={false} />
}
