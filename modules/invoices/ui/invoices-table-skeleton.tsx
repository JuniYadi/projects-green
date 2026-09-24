"use client"

import { useParams } from "next/navigation"

import { getMessagesForMaybeLocale } from "@/lib/i18n/messages"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"

export function InvoicesTableSkeleton() {
  const params = useParams<{ lang?: string }>()
  const messages = getMessagesForMaybeLocale(params?.lang).console.billing
    .invoiceTable

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{messages.columnInvoice}</TableHead>
          <TableHead>{messages.columnIssuedDate}</TableHead>
          <TableHead>{messages.columnDueDate}</TableHead>
          <TableHead>{messages.columnAmount}</TableHead>
          <TableHead>{messages.columnStatus}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: 5 }).map((_, i) => (
          <TableRow key={i}>
            <TableCell>
              <Skeleton className="h-4 w-24" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-20" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-20" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-16" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-5 w-16" />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
