import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default async function VpnPackagesPage() {
  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Packages</h1>
        <p className="text-sm text-muted-foreground">
          Define VPN packages, pricing, and billing periods.
        </p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Coming soon</CardTitle>
          <CardDescription>
            Package and pricing management ships with Story 13.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          This surface is reserved for VPN package CRUD and pricing
          configuration.
        </CardContent>
      </Card>
    </main>
  )
}
