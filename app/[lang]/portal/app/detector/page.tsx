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
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Detector Control Center</h1>
        <p className="text-sm text-muted-foreground">
          Govern the AI Detector Toolchain — manage detection rules, runtime
          mappings, and review AI recommendations.
        </p>
      </header>
      <DetectorTabs defaultTab={tab} />
    </main>
  )
}
