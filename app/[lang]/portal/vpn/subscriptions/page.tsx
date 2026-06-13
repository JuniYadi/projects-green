import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default async function VpnSubscriptionsPage() {
  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Subscriptions</h1>
        <p className="text-sm text-muted-foreground">
          Review and manage customer VPN subscriptions.
        </p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Coming soon</CardTitle>
          <CardDescription>
            Subscription management ships with Story 15.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          This surface is reserved for customer subscription review and
          lifecycle actions.
        </CardContent>
      </Card>
    </main>
  )
}
