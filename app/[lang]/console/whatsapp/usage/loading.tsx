import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartLine, ChatCircle, PaperPlaneTilt, CurrencyDollar } from "@phosphor-icons/react"

export default function WhatsAppUsageLoading() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-96" />
      </header>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Messages</CardTitle>
            <ChartLine className="size-4 text-muted-foreground" weight="fill" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-7 w-20" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inbound Count</CardTitle>
            <ChatCircle className="size-4 text-muted-foreground" weight="fill" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-7 w-20" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outbound Count</CardTitle>
            <PaperPlaneTilt className="size-4 text-muted-foreground" weight="fill" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-7 w-20" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
            <CurrencyDollar className="size-4 text-muted-foreground" weight="fill" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-7 w-20" />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Quota Used</CardTitle>
            <ChartLine className="size-4 text-muted-foreground" weight="fill" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-7 w-20" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Remaining Quota</CardTitle>
            <ChatCircle className="size-4 text-muted-foreground" weight="fill" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-7 w-20" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Projected Cost</CardTitle>
            <CurrencyDollar className="size-4 text-muted-foreground" weight="fill" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-7 w-20" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Balance</CardTitle>
            <CurrencyDollar className="size-4 text-muted-foreground" weight="fill" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-7 w-20" />
          </CardContent>
        </Card>
      </div>

      <Skeleton className="h-[370px] w-full" />

      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    </div>
  )
}
