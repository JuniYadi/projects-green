"use client"

import * as React from "react"
import {
  Activity,
  CheckCircle2,
  AlertCircle,
  Clock,
  Play,
  RotateCw,
  Search,
  Terminal,
  Copy,
  Loader2,
  Check,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import type {
  CronJobDefinitionDTO,
  CronJobExecutionDTO,
  CronSystemMetricsDTO,
} from "@/modules/admin/api/dto/cronjob.dto"

export function CronJobsManagementView() {
  const [activeTab, setActiveTab] = React.useState("overview")
  const [metrics, setMetrics] = React.useState<CronSystemMetricsDTO | null>(
    null
  )
  const [jobs, setJobs] = React.useState<CronJobDefinitionDTO[]>([])
  const [executions, setExecutions] = React.useState<CronJobExecutionDTO[]>([])
  const [loading, setLoading] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const [categoryFilter, setCategoryFilter] = React.useState<string>("ALL")
  const [statusFilter, setStatusFilter] = React.useState<string>("ALL")
  const [page, setPage] = React.useState(1)
  const [totalExecutions, setTotalExecutions] = React.useState(0)

  // Trigger modal state
  const [triggerJob, setTriggerJob] =
    React.useState<CronJobDefinitionDTO | null>(null)
  const [triggerReason, setTriggerReason] = React.useState("")
  const [triggering, setTriggering] = React.useState(false)

  // Log drawer state
  const [selectedExecution, setSelectedExecution] =
    React.useState<CronJobExecutionDTO | null>(null)
  const [drawerOpen, setDrawerOpen] = React.useState(false)
  const [copiedLog, setCopiedLog] = React.useState(false)

  React.useEffect(() => {
    let ignore = false

    const load = async () => {
      setLoading(true)
      try {
        if (activeTab === "overview") {
          const res = await fetch("/api/admin/cronjobs")
          if (!res.ok) throw new Error("Failed to load cronjobs")
          const data = (await res.json()) as {
            jobs: CronJobDefinitionDTO[]
            metrics: CronSystemMetricsDTO
          }
          if (!ignore) {
            setJobs(data.jobs || [])
            setMetrics(data.metrics || null)
          }
        } else if (activeTab === "history") {
          const query = new URLSearchParams()
          if (statusFilter !== "ALL") query.set("status", statusFilter)
          query.set("page", String(page))
          query.set("limit", "15")

          const res = await fetch(
            `/api/admin/cronjobs/executions?${query.toString()}`
          )
          if (!res.ok) throw new Error("Failed to load executions")
          const data = (await res.json()) as {
            executions: CronJobExecutionDTO[]
            total: number
          }
          if (!ignore) {
            setExecutions(data.executions || [])
            setTotalExecutions(data.total || 0)
          }
        }
      } catch (err: unknown) {
        if (!ignore) {
          const msg = err instanceof Error ? err.message : "Failed to load data"
          toast.error(msg)
        }
      } finally {
        if (!ignore) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      ignore = true
    }
  }, [activeTab, statusFilter, page])

  const refreshData = () => {
    if (activeTab === "overview") {
      void fetch("/api/admin/cronjobs")
        .then((res) => res.json())
        .then((data) => {
          setJobs(data.jobs || [])
          setMetrics(data.metrics || null)
        })
    } else {
      const query = new URLSearchParams()
      if (statusFilter !== "ALL") query.set("status", statusFilter)
      query.set("page", String(page))
      query.set("limit", "15")
      void fetch(`/api/admin/cronjobs/executions?${query.toString()}`)
        .then((res) => res.json())
        .then((data) => {
          setExecutions(data.executions || [])
          setTotalExecutions(data.total || 0)
        })
    }
  }
  const handleTrigger = async () => {
    if (!triggerJob) return
    try {
      setTriggering(true)
      const res = await fetch(
        `/api/admin/cronjobs/${triggerJob.code}/trigger`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reason: triggerReason || "Manual trigger from portal console",
            triggeredBy: "Super Admin",
          }),
        }
      )
      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || "Failed to trigger cronjob")
      }
      toast.success(`Job ${triggerJob.name} successfully dispatched to queue`)
      setTriggerReason("")
      refreshData()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Trigger failed"
      toast.error(msg)
    } finally {
      setTriggering(false)
    }
  }

  const handleCopyLog = () => {
    if (!selectedExecution?.logTail) return
    navigator.clipboard.writeText(selectedExecution.logTail)
    setCopiedLog(true)
    setTimeout(() => setCopiedLog(false), 2000)
    toast.success("Logs copied to clipboard")
  }

  const filteredJobs = React.useMemo(() => {
    return jobs.filter((job) => {
      const matchesSearch =
        search === "" ||
        job.name.toLowerCase().includes(search.toLowerCase()) ||
        job.code.toLowerCase().includes(search.toLowerCase()) ||
        (job.description &&
          job.description.toLowerCase().includes(search.toLowerCase()))
      const matchesCategory =
        categoryFilter === "ALL" || job.category === categoryFilter
      return matchesSearch && matchesCategory
    })
  }, [jobs, search, categoryFilter])
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "HEALTHY":
      case "SUCCESS":
        return (
          <Badge className="border-emerald-500/20 bg-emerald-500/10 text-emerald-600">
            <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
            {status}
          </Badge>
        )
      case "RUNNING":
        return (
          <Badge className="animate-pulse border-blue-500/20 bg-blue-500/10 text-blue-600">
            <Activity className="mr-1 h-3.5 w-3.5" />
            RUNNING
          </Badge>
        )
      case "FAILED":
      case "TIMED_OUT":
        return (
          <Badge className="border-rose-500/20 bg-rose-500/10 text-rose-600">
            <AlertCircle className="mr-1 h-3.5 w-3.5" />
            {status}
          </Badge>
        )
      case "MISSED":
      case "DEGRADED":
        return (
          <Badge className="border-amber-500/20 bg-amber-500/10 text-amber-600">
            <Clock className="mr-1 h-3.5 w-3.5" />
            {status}
          </Badge>
        )
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 pt-0">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            CronJob & Worker Monitoring
          </h1>
          <p className="text-sm text-muted-foreground">
            Real-time execution telemetry, Kubernetes runner schedules, and log
            inspection.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={refreshData}
            disabled={loading}
          >
            <RotateCw
              className={`mr-1.5 h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Registered Schedulers
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.totalJobs ?? "-"}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Code & K8s Registry Definitions
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Healthy Jobs</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {metrics?.healthyJobs ?? "-"}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Operating within normal schedule
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Needs Attention
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-rose-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-600">
              {metrics?.failingJobs ?? "-"}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Failed or missed executions
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Pods</CardTitle>
            <Activity className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {metrics?.runningJobs ?? "-"}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Currently executing runners
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-4"
      >
        <TabsList>
          <TabsTrigger value="overview">Overview & Schedules</TabsTrigger>
          <TabsTrigger value="history">Execution History & Logs</TabsTrigger>
        </TabsList>

        {/* Tab 1: Overview */}
        <TabsContent value="overview" className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex max-w-sm flex-1 items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search jobs by name or code..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <select
                aria-label="Filter by category"
                className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="ALL">All Categories</option>
                <option value="billing">Billing</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="vpn">VPN</option>
                <option value="system">System</option>
              </select>
            </div>
          </div>

          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job Name / Code</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Schedule (Cron UTC)</TableHead>
                  <TableHead>Last Run</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredJobs.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-8 text-center text-muted-foreground"
                    >
                      No cronjobs found matching criteria.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredJobs.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell>
                        <div className="font-medium">{job.name}</div>
                        <div className="font-mono text-xs text-muted-foreground">
                          {job.code}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {job.category}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="inline-block rounded bg-muted px-2 py-1 font-mono text-xs font-semibold">
                          {job.cronExpression}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {job.lastRunAt
                            ? new Date(job.lastRunAt).toLocaleString()
                            : "Never"}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(job.lastStatus)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setTriggerJob(job)}
                          className="h-8 gap-1"
                        >
                          <Play className="h-3.5 w-3.5" />
                          Run
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Tab 2: Execution History */}
        <TabsContent value="history" className="space-y-4">
          <div className="flex items-center gap-2">
            <select
              aria-label="Filter by execution status"
              className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setPage(1)
              }}
            >
              <option value="ALL">All Statuses</option>
              <option value="SUCCESS">Success</option>
              <option value="FAILED">Failed</option>
              <option value="RUNNING">Running</option>
            </select>
          </div>

          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Execution ID</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Pod / Host</TableHead>
                  <TableHead>Started At</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Logs</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {executions.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="py-8 text-center text-muted-foreground"
                    >
                      No execution history recorded.
                    </TableCell>
                  </TableRow>
                ) : (
                  executions.map((exec) => (
                    <TableRow key={exec.id}>
                      <TableCell className="font-mono text-xs font-medium">
                        {exec.id.slice(0, 12)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {exec.triggerType}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {exec.podName || "unknown-pod"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {new Date(exec.startedAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-sm">
                        {exec.durationMs
                          ? `${(exec.durationMs / 1000).toFixed(2)}s`
                          : "-"}
                      </TableCell>
                      <TableCell>{getStatusBadge(exec.status)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedExecution(exec)
                            setDrawerOpen(true)
                          }}
                          className="h-7 gap-1 text-xs"
                        >
                          <Terminal className="h-3.5 w-3.5" />
                          View Log
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
            <span>Total executions: {totalExecutions}</span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="h-7 text-xs"
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={executions.length < 15}
                onClick={() => setPage((p) => p + 1)}
                className="h-7 text-xs"
              >
                Next
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Manual Trigger Dialog */}
      <Dialog
        open={!!triggerJob}
        onOpenChange={(open) => !open && setTriggerJob(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Trigger On-Demand Execution</DialogTitle>
            <DialogDescription>
              Dispatches an immediate queue payload for job{" "}
              <span className="font-mono font-semibold">
                {triggerJob?.name}
              </span>
              .
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="rounded-md border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-600">
              ⚠️ <strong>Audit Notice:</strong> Manual runs bypass scheduled
              cron time-windows and are logged permanently for audit trails.
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Reason for Manual Trigger
              </label>
              <Input
                placeholder="e.g. Re-running after upstream network resolution"
                value={triggerReason}
                onChange={(e) => setTriggerReason(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setTriggerJob(null)}
              disabled={triggering}
            >
              Cancel
            </Button>
            <Button onClick={handleTrigger} disabled={triggering}>
              {triggering && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm & Run Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Log Terminal Drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent
          side="right"
          className="flex w-full flex-col p-6 sm:max-w-2xl"
        >
          <SheetHeader className="border-b pb-4">
            <SheetTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5" />
              Execution Details & Logs
            </SheetTitle>
            <SheetDescription>
              Execution ID:{" "}
              <span className="font-mono">{selectedExecution?.id}</span>
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-4 overflow-y-auto py-4">
            {/* Metadata */}
            <div className="grid grid-cols-2 gap-3 rounded-md bg-muted/50 p-3 text-sm">
              <div>
                <span className="text-muted-foreground">Pod / Runner:</span>{" "}
                <span className="font-mono font-medium">
                  {selectedExecution?.podName}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Duration:</span>{" "}
                <span className="font-medium">
                  {selectedExecution?.durationMs
                    ? `${(selectedExecution.durationMs / 1000).toFixed(2)}s`
                    : "-"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Status:</span>{" "}
                {selectedExecution && getStatusBadge(selectedExecution.status)}
              </div>
              <div>
                <span className="text-muted-foreground">Trigger:</span>{" "}
                <span className="font-medium">
                  {selectedExecution?.triggerType}
                </span>
              </div>
            </div>

            {/* Error detail if any */}
            {selectedExecution?.errorMessage && (
              <div className="rounded-md border border-rose-500/20 bg-rose-500/10 p-3 font-mono text-xs text-rose-600">
                <div className="mb-1 font-bold">Error Message:</div>
                {selectedExecution.errorMessage}
              </div>
            )}

            {/* Summary object */}
            {selectedExecution?.summary && (
              <div>
                <h4 className="mb-1 text-xs font-semibold text-muted-foreground uppercase">
                  Execution Output Summary
                </h4>
                <pre className="overflow-x-auto rounded-md border bg-card p-3 font-mono text-xs">
                  {JSON.stringify(selectedExecution.summary, null, 2)}
                </pre>
              </div>
            )}

            {/* Terminal Output */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase">
                  Terminal Logs (Tail Buffer)
                </h4>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyLog}
                  className="h-7 gap-1 text-xs"
                >
                  {copiedLog ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  {copiedLog ? "Copied" : "Copy Log"}
                </Button>
              </div>
              <div className="max-h-[450px] overflow-x-auto rounded-md bg-zinc-950 p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap text-zinc-100">
                {selectedExecution?.logTail ||
                  "No console output recorded for this run."}
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
