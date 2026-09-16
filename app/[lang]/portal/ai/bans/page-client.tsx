"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Plus, ArrowCounterClockwise } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
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
import { getMessages } from "@/lib/i18n/messages"
import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"

export type BanRow = {
  id: string
  banType: "IP" | "USER" | "ORGANIZATION" | "PHONE"
  targetValue: string
  organizationId: string | null
  offenseLevel: number
  strikeSnapshot: number
  reason: string
  isPermanent: boolean
  blockedUntil: string | null
  timeRemaining: string
  createdAt: string
}

export default function PortalAiBansPage() {
  const params = useParams()
  const lang = typeof params?.lang === "string" ? params.lang : "en"
  const locale = resolveLocaleOrDefault(lang)
  const messages = getMessages(locale).console.aiBans

  const [bans, setBans] = useState<BanRow[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("ALL")

  // Create Ban Dialog State
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [banType, setBanType] = useState<
    "IP" | "USER" | "ORGANIZATION" | "PHONE"
  >("IP")
  const [targetValue, setTargetValue] = useState("")
  const [durationHours, setDurationHours] = useState(24)
  const [isPermanent, setIsPermanent] = useState(false)
  const [reason, setReason] = useState("")
  const [createLoading, setCreateLoading] = useState(false)

  // Pardon Dialog State
  const [pardonBanId, setPardonBanId] = useState<string | null>(null)
  const [pardonReason, setPardonReason] = useState("")
  const [pardonLoading, setPardonLoading] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let isMounted = true
    async function loadBans() {
      try {
        const { data: resData } = await eden.api.admin.ai.bans.get()
        if (isMounted && resData && "ok" in resData && resData.ok) {
          setBans((resData as { ok: true; data: { bans: BanRow[] } }).data.bans)
        }
      } catch (err) {
        console.error("Failed to load bans:", err)
      } finally {
        if (isMounted) setLoading(false)
      }
    }
    loadBans()
    return () => {
      isMounted = false
    }
  }, [reloadKey])

  const triggerReload = () => {
    setLoading(true)
    setReloadKey((k) => k + 1)
  }

  const handleCreateBan = async () => {
    if (!targetValue.trim()) return
    setCreateLoading(true)
    try {
      const { data: resData } = await eden.api.admin.ai.bans.create.post({
        banType,
        targetValue: targetValue.trim(),
        durationHours: isPermanent ? undefined : durationHours,
        isPermanent,
        reason: reason.trim() || "Manual super admin ban",
      })
      if (resData && "ok" in resData && resData.ok) {
        setIsCreateOpen(false)
        setTargetValue("")
        setReason("")
        triggerReload()
      }
    } catch (err) {
      console.error("Failed to create ban:", err)
    } finally {
      setCreateLoading(false)
    }
  }

  const handlePardon = async () => {
    if (!pardonBanId) return
    setPardonLoading(true)
    try {
      const { data: resData } = await eden.api.admin.ai.bans.pardon.post({
        banId: pardonBanId,
        reason: pardonReason.trim() || "Admin 1-click pardon",
      })
      if (resData && "ok" in resData && resData.ok) {
        setPardonBanId(null)
        setPardonReason("")
        triggerReload()
      }
    } catch (err) {
      console.error("Failed to pardon ban:", err)
    } finally {
      setPardonLoading(false)
    }
  }

  const filteredBans =
    activeTab === "ALL" ? bans : bans.filter((b) => b.banType === activeTab)

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href={localizePathname({ pathname: "/portal/ai", locale })}
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              {messages.governanceBreadcrumb}
            </Link>
            <span className="text-muted-foreground">/</span>
            <h1 className="text-2xl font-semibold tracking-tight">
              {messages.title}
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            {messages.description}
          </p>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" />
              {messages.addBlacklist}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{messages.addModalTitle}</DialogTitle>
              <DialogDescription>
                {messages.addModalDesc}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="banType">{messages.banTypeLabel}</Label>
                <Select
                  value={banType}
                  onValueChange={(v) =>
                    setBanType(v as "IP" | "USER" | "ORGANIZATION" | "PHONE")
                  }
                >
                  <SelectTrigger id="banType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IP">{messages.typeIp}</SelectItem>
                    <SelectItem value="USER">{messages.typeUser}</SelectItem>
                    <SelectItem value="ORGANIZATION">{messages.typeOrg}</SelectItem>
                    <SelectItem value="PHONE">{messages.typePhone}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="targetValue">{messages.targetValueLabel}</Label>
                <Input
                  id="targetValue"
                  placeholder={
                    banType === "IP"
                      ? "103.21.244.1"
                      : banType === "USER"
                        ? "user_xyz or attacker@evil.com"
                        : banType === "PHONE"
                          ? "6281234567890"
                          : "org_abc123"
                  }
                  value={targetValue}
                  onChange={(e) => setTargetValue(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="duration">{messages.durationLabel}</Label>
                <Select
                  value={isPermanent ? "PERMANENT" : String(durationHours)}
                  onValueChange={(val) => {
                    if (val === "PERMANENT") {
                      setIsPermanent(true)
                    } else {
                      setIsPermanent(false)
                      setDurationHours(Number(val))
                    }
                  }}
                >
                  <SelectTrigger id="duration">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">{messages.duration1h}</SelectItem>
                    <SelectItem value="12">{messages.duration12h}</SelectItem>
                    <SelectItem value="24">{messages.duration24h}</SelectItem>
                    <SelectItem value="168">{messages.duration7d}</SelectItem>
                    <SelectItem value="PERMANENT">{messages.durationPermanent}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="reason">{messages.reasonLabel}</Label>
                <Input
                  id="reason"
                  placeholder={messages.reasonPlaceholder}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                {messages.cancel}
              </Button>
              <Button
                onClick={handleCreateBan}
                disabled={createLoading || !targetValue.trim()}
              >
                {createLoading ? messages.creating : messages.createBan}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      {/* Tabs Filter */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="ALL">{messages.tabAll} ({bans.length})</TabsTrigger>
          <TabsTrigger value="ORGANIZATION">
            {messages.tabOrg} (
            {bans.filter((b) => b.banType === "ORGANIZATION").length})
          </TabsTrigger>
          <TabsTrigger value="IP">
            {messages.tabIp} ({bans.filter((b) => b.banType === "IP").length})
          </TabsTrigger>
          <TabsTrigger value="USER">
            {messages.tabUser} ({bans.filter((b) => b.banType === "USER").length})
          </TabsTrigger>
          <TabsTrigger value="PHONE">
            {messages.tabPhone} ({bans.filter((b) => b.banType === "PHONE").length})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* DataTable */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{messages.thTargetValue}</TableHead>
                <TableHead>{messages.thBanType}</TableHead>
                <TableHead>{messages.thOffenseLevel}</TableHead>
                <TableHead>{messages.thTimeRemaining}</TableHead>
                <TableHead>{messages.thStrikeSnapshot}</TableHead>
                <TableHead>{messages.thReason}</TableHead>
                <TableHead>{messages.thCreated}</TableHead>
                <TableHead className="text-right">{messages.thAction}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="py-8 text-center text-muted-foreground"
                  >
                    {messages.loadingBans}
                  </TableCell>
                </TableRow>
              ) : filteredBans.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="py-8 text-center text-muted-foreground"
                  >
                    {messages.noActiveBans}
                  </TableCell>
                </TableRow>
              ) : (
                filteredBans.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-mono text-xs font-semibold text-foreground">
                      {b.targetValue}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {b.banType}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          b.offenseLevel >= 3 ? "destructive" : "secondary"
                        }
                        className="text-[10px]"
                      >
                        {messages.levelPrefix} {b.offenseLevel}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs font-medium">
                      {b.isPermanent ? (
                        <span className="font-semibold text-destructive">
                          {messages.permanent}
                        </span>
                      ) : (
                        <span className="text-orange-600">
                          {b.timeRemaining}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {b.strikeSnapshot} {messages.strikeSuffix}
                    </TableCell>
                    <TableCell
                      className="max-w-xs truncate text-xs"
                      title={b.reason}
                    >
                      {b.reason}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(b.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPardonBanId(b.id)}
                        className="h-8 gap-1 text-xs text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                      >
                        <ArrowCounterClockwise className="h-3.5 w-3.5" />
                        {messages.pardon}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pardon Confirmation Modal */}
      <Dialog
        open={Boolean(pardonBanId)}
        onOpenChange={(open) => !open && setPardonBanId(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{messages.pardonModalTitle}</DialogTitle>
            <DialogDescription>
              {messages.pardonModalDesc}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="pardonReason">{messages.pardonReasonLabel}</Label>
              <Input
                id="pardonReason"
                placeholder={messages.pardonReasonPlaceholder}
                value={pardonReason}
                onChange={(e) => setPardonReason(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPardonBanId(null)}>
              {messages.cancel}
            </Button>
            <Button onClick={handlePardon} disabled={pardonLoading}>
              {pardonLoading ? messages.pardoning : messages.confirmPardon}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}
