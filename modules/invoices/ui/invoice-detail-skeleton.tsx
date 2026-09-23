"use client"

import { useParams } from "next/navigation"

import { getMessagesForMaybeLocale } from "@/lib/i18n/messages"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export function InvoiceDetailSkeleton() {
  const params = useParams<{ lang?: string }>()
  const messages = getMessagesForMaybeLocale(params?.lang).console.invoices
    .detail

  return (
    <div
      className="flex w-full max-w-7xl flex-col gap-6"
      data-testid="invoice-detail-skeleton"
    >
      {/* 1. Header Card */}
      <Card>
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Skeleton className="h-7 w-40" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-4 w-56" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-28" />
          </div>
        </CardContent>
      </Card>

      {/* 2-Column Grid */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        {/* Left Column (8 cols) */}
        <div className="flex flex-col gap-6 lg:col-span-8">
          {/* Parties Card */}
          <Card>
            <CardContent className="grid gap-6 divide-y divide-border p-5 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
              <div className="space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-48" />
                <Skeleton className="h-3 w-32" />
              </div>
              <div className="space-y-2 pt-4 sm:pt-0 sm:pl-6">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-44" />
                <Skeleton className="h-3 w-52" />
                <Skeleton className="h-3 w-36" />
              </div>
            </CardContent>
          </Card>

          {/* Line Items & Totals Card */}
          <Card className="overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {messages.lineItemsHeading}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50%] pl-6">
                      {messages.descriptionColumn}
                    </TableHead>
                    <TableHead className="w-[15%] text-right">
                      {messages.qtyColumn}
                    </TableHead>
                    <TableHead className="w-[20%] text-right">
                      {messages.unitPriceColumn}
                    </TableHead>
                    <TableHead className="w-[15%] pr-6 text-right">
                      {messages.amountColumn}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 2 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell className="pl-6">
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                      <TableCell className="text-right">
                        <Skeleton className="ml-auto h-4 w-8" />
                      </TableCell>
                      <TableCell className="text-right">
                        <Skeleton className="ml-auto h-4 w-16" />
                      </TableCell>
                      <TableCell className="pr-6 text-right">
                        <Skeleton className="ml-auto h-4 w-16" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex flex-col items-end border-t bg-muted/15 px-6 py-4">
                <div className="w-full max-w-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-3 w-8" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                  <div className="flex items-center justify-between border-t pt-2">
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column (4 cols) */}
        <div className="flex flex-col gap-6 lg:col-span-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {messages.overviewHeading}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 divide-y">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-2 first:pt-0"
                >
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-4 w-28" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
