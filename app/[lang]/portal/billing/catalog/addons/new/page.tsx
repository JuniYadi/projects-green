import type { Metadata } from "next"

import AddonEditorPage from "@/app/[lang]/portal/billing/catalog/addons/[addonCode]/page"

export const metadata: Metadata = { title: "New Add-on" }

export default function NewAddonEditorPage() {
  return <AddonEditorPage />
}
