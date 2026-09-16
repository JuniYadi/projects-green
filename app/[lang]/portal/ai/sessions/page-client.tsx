"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import {
  MagnifyingGlass,
  ArrowRight,
  CaretLeft,
  CaretRight,
} from "@phosphor-icons/react"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { eden } from "@/lib/eden"
import { getMessagesForMaybeLocale } from "@/lib/i18n/messages"
import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"

export type SessionRow = {
  id: string
  sessionId: string
  organizationId: string | null
  agentProfileId: string | null
  channel: string
  channelTargetId: string | null
  userId: string | null
  userEmail: string | null
  customerPhone: string | null
  ipAddress: string | null
  strikeCount: number
  messageCount: number
  totalTokens: number
  isFlagged: boolean
  createdAt: string
  updatedAt: string
}

export type SessionsResponse = {
  sessions: SessionRow[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export default function PortalAiSessionsPage() {
  const params = useParams()
  const lang = typeof params?.lang === "string" ? params.lang : "en"
  const locale = resolveLocaleOrDefault(lang)
  const messages = getMessagesForMaybeLocale(lang).console.aiSessions

  const [data, setData] = useState<SessionsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [channel, setChannel] = useState("ALL")
  const [status, setStatus] = useState("ALL")
  const [page, setPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    let isMounted = true
    async function loadSessions() {
      try {
        const { data: resData } = await eden.api.admin.ai.sessions.get({
          $query: {
            page: String(page),
            limit: "20",
            channel,
            status,
            search: searchQuery,
          },
        })
        if (isMounted && resData && "ok" in resData && resData.ok) {
          setData((resData as { ok: true; data: SessionsResponse }).data)
        }
      } catch (err) {
        console.error("Failed to load sessions:", err)
      } finally {
        if (isMounted) setLoading(false)
      }
    }
    loadSessions()
    return () => {
      isMounted = false
    }
  }, [page, channel, status, searchQuery])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    setSearchQuery(search)
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href={localizePathname({ pathname: "/portal/ai", locale })}
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              {messages.breadcrumbGovernance}
            </Link>
            <span className="text-muted-foreground">/</span>
            <h1 className="text-2xl font-semibold tracking-tight">
              {messages.heading}
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            {messages.description}
          </p>
        </div>
      </header>

      {/* Filter Toolbar */}
      <Card>
        <CardContent className="p-4">
          <form
            onSubmit={handleSearchSubmit}
            className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex flex-1 items-center gap-2">
              <div className="relative max-w-sm flex-1">
                <MagnifyingGlass className="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={messages.searchPlaceholder}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Button type="submit" size="sm" variant="secondary">
                {messages.searchButton}
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={channel}
                onValueChange={(val) => {
                  setChannel(val)
                  setPage(1)
                }}
              >
                <SelectTrigger className="h-9 w-[140px]">
                  <SelectValue placeholder={messages.channelPlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{messages.allChannels}</SelectItem>
                  <SelectItem value="CONSOLE">
                    {messages.channelConsole}
                  </SelectItem>
                  <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                  <SelectItem value="WEB_LIVECHAT">
                    {messages.channelWebLivechat}
                  </SelectItem>
                  <SelectItem value="TELEGRAM">
                    {messages.channelTelegram}
                  </SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={status}
                onValueChange={(val) => {
                  setStatus(val)
                  setPage(1)
                }}
              >
                <SelectTrigger className="h-9 w-[130px]">
                  <SelectValue placeholder={messages.statusPlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{messages.allStatus}</SelectItem>
                  <SelectItem value="CLEAN">{messages.cleanOnly}</SelectItem>
                  <SelectItem value="FLAGGED">
                    {messages.flaggedOnly}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* DataTable */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{messages.thSessionId}</TableHead>
                <TableHead>{messages.thUserCaller}</TableHead>
                <TableHead>{messages.thOrganization}</TableHead>
                <TableHead>{messages.thChannel}</TableHead>
                <TableHead className="text-center">
                  {messages.thMessages}
                </TableHead>
                <TableHead className="text-right">
                  {messages.thTokens}
                </TableHead>
                <TableHead className="text-center">
                  {messages.thStrikes}
                </TableHead>
                <TableHead>{messages.thCreated}</TableHead>
                <TableHead className="text-right">
                  {messages.thAction}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="py-8 text-center text-muted-foreground"
                  >
                    {messages.loadingSessions}
                  </TableCell>
                </TableRow>
              ) : !data?.sessions || data.sessions.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="py-8 text-center text-muted-foreground"
                  >
                    {messages.noSessionsFound}
                  </TableCell>
                </TableRow>
              ) : (
                data.sessions.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-xs font-medium">
                      {s.sessionId.slice(0, 16)}...
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col text-xs">
                        <span className="font-medium text-foreground">
                          {s.userEmail || s.customerPhone || "Anonymous"}
                        </span>
                        {s.ipAddress && (
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {s.ipAddress}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      {s.organizationId ? (
                        <span className="font-mono text-muted-foreground">
                          {s.organizationId}
                        </span>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">
                          {messages.internalBadge}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[10px]">
                        {s.channel}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center font-mono text-xs">
                      {s.messageCount}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {s.totalTokens.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-center">
                      {s.strikeCount > 0 ? (
                        <Badge variant="destructive" className="text-[10px]">
                          {s.strikeCount} {messages.strikeSuffix}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(s.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={localizePathname({
                          pathname: `/portal/ai/sessions/${s.sessionId}`,
                          locale,
                        })}
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1 text-xs"
                        >
                          {messages.inspect}
                          <ArrowRight className="h-3 w-3" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination Bar */}
      {data?.pagination && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between px-2 text-xs text-muted-foreground">
          <div>
            {messages.showing} {(page - 1) * data.pagination.limit + 1}{" "}
            {messages.to}{" "}
            {Math.min(page * data.pagination.limit, data.pagination.total)}{" "}
            {messages.of} {data.pagination.total} {messages.sessionsUnit}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="h-8 w-8 p-0"
            >
              <CaretLeft className="h-4 w-4" />
            </Button>
            <span className="font-mono">
              {page} / {data.pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= data.pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="h-8 w-8 p-0"
            >
              <CaretRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </main>
  )
}
