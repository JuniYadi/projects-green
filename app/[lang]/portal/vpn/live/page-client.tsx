"use client"

import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { ArrowClockwise } from "@phosphor-icons/react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import {
  listWireGuardSessions,
  type WireGuardSessionItem,
} from "../_components/vpn-admin-client"

function SessionTable({ sessions }: { sessions: WireGuardSessionItem[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Server</TableHead>
            <TableHead>Protocol</TableHead>
            <TableHead>Username</TableHead>
            <TableHead>IP address</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Handshake</TableHead>
            <TableHead>Transfer</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sessions.map((session) => (
            <TableRow key={`${session.serverId}:${session.username}`}>
              <TableCell className="font-medium">
                {session.serverName}
              </TableCell>
              <TableCell className="text-xs">{session.protocol}</TableCell>
              <TableCell className="font-mono text-sm">
                {session.username}
              </TableCell>
              <TableCell className="font-mono text-xs">{session.ip}</TableCell>
              <TableCell>
                <Badge variant="default">{session.status}</Badge>
              </TableCell>
              <TableCell className="text-xs">{session.handshake}</TableCell>
              <TableCell className="font-mono text-xs">
                ↓ {session.rx} / ↑ {session.tx}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export default function WireGuardPage() {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale).pPortalVpnWireguardPageClient
  const query = useQuery({
    queryKey: ["portal", "vpn", "wireguard-sessions"],
    queryFn: async () => (await listWireGuardSessions()).data,
    refetchInterval: 60_000,
    refetchIntervalInBackground: true,
  })
  const sessions = query.data ?? []

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">{messages.pageTitle}</h1>
          <p className="text-sm text-muted-foreground">
            {messages.pageDescription}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => query.refetch()}
          disabled={query.isFetching}
        >
          <ArrowClockwise className="mr-2 h-4 w-4" />
          {query.isFetching ? messages.refreshing : messages.refresh}
        </Button>
      </header>

      {query.isError ? (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-600">
          {messages.loadError}
        </div>
      ) : query.isLoading ? (
        <div className="rounded-lg border p-4">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="mt-3 h-8 w-full" />
          <Skeleton className="mt-3 h-8 w-full" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          {messages.noSessions}
        </div>
      ) : (
        <SessionTable sessions={sessions} />
      )}
    </main>
  )
}
