import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { DetectorTabs } from "./_components/detector-tabs"

export default async function DetectorGovernancePage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    tab?: string
  }>
}>) {
  const { tab } = await searchParams

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <div>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/portal/app">App Hosting</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Detector Control Center</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <h1 className="mt-2 text-2xl font-bold">
          Detector Control Center
        </h1>
        <p className="text-sm text-muted-foreground">
          Govern the AI Detector Toolchain — manage detection rules,
          runtime mappings, and review AI recommendations.
        </p>
      </div>
      <DetectorTabs defaultTab={tab} />
    </main>
  )
}
