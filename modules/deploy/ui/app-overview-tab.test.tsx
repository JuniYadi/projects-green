import { describe, expect, it, mock, afterEach } from "bun:test"
import { cleanup, render } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { AppOverviewTab, resolveHealthVerdict } from "./app-overview-tab"
import type { StackSummaryDTO } from "../deploy-monitor.dto"
import type {
  ClusterTelemetrySummary,
  PodMetricSummary,
  PodStatusState,
} from "@/modules/deploy/telemetry.types"

afterEach(cleanup)

mock.module("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {} }),
}))

const t = {
  deploying: "deploying",
  deployingDetail: "deployingDetail",
  running: "running",
  runningDetail: "runningDetail",
  restarting: "restarting",
  restartingDetail: "restartingDetail",
  notReady: "notReady",
  notReadyDetail: "notReadyDetail",
  down: "down",
  downDetail: "downDetail",
  unreachable: "unreachable",
  unreachableDetail: "unreachableDetail",
  unknown: "unknown",
  unknownDetail: "unknownDetail",
}

const pod = (over: Partial<PodMetricSummary> = {}): PodMetricSummary => ({
  pod: "app-0",
  status: "Running" as PodStatusState,
  ready: true,
  cpuUsageCores: 0,
  cpuLimitCores: 2,
  cpuPercent: 0,
  memoryUsageBytes: 0,
  memoryLimitBytes: 8,
  memoryPercent: 0,
  restarts: 0,
  ...over,
})

const summary = (
  pods: PodMetricSummary[],
  ingress?: { healthyServers: number; trafficRps?: number }
): ClusterTelemetrySummary =>
  ({
    clusterId: "sgp",
    clusterName: "Singapore",
    region: "Singapore",
    isPrimary: true,
    timeRange: "1h",
    points: [],
    cpu: { currentCores: 0, limitCores: 2, avgCores: 0, peakCores: 0 },
    memory: { currentBytes: 0, limitBytes: 8, avgBytes: 0, peakBytes: 0 },
    network: {
      currentRxBytes: 0,
      currentTxBytes: 0,
      totalRxBytes: 0,
      totalTxBytes: 0,
    },
    pods,
    ...(ingress === undefined
      ? {}
      : {
          ingress: {
            healthyServers: ingress.healthyServers,
            trafficRps: ingress.trafficRps ?? 0,
            activeSessions: 0,
          } as ClusterTelemetrySummary["ingress"],
        }),
  }) as ClusterTelemetrySummary

describe("resolveHealthVerdict", () => {
  it("reports healthy when the pod runs, is ready and never restarted", () => {
    const v = resolveHealthVerdict(summary([pod()], { healthyServers: 1 }), t)
    expect(v.tone).toBe("healthy")
    expect(v.headline).toBe("running")
  })

  it("reports unknown when telemetry has no pods yet", () => {
    expect(resolveHealthVerdict(summary([]), t).tone).toBe("unknown")
    expect(resolveHealthVerdict(undefined, t).tone).toBe("unknown")
  })

  it("reports down with the container reason when the pod is not Running", () => {
    const v = resolveHealthVerdict(
      summary([pod({ status: "CrashLoopBackOff", reason: "OOMKilled" })]),
      t
    )
    expect(v.tone).toBe("down")
    expect(v.detail).toBe("CrashLoopBackOff — OOMKilled")
  })

  it("flags a running-but-not-ready pod as a warning", () => {
    expect(resolveHealthVerdict(summary([pod({ ready: false })]), t).tone).toBe(
      "warning"
    )
  })

  it("flags an unreachable app only when the ingress has traffic it cannot serve", () => {
    const v = resolveHealthVerdict(
      summary([pod()], { healthyServers: 0, trafficRps: 4 }),
      t
    )
    expect(v.headline).toBe("unreachable")
  })

  it("does not cry outage on an idle app whose backend gauge reports zero", () => {
    // `healthyServers` folds a missing metric into 0; with no traffic that is
    // silence, not an outage, and the ready pod wins.
    const v = resolveHealthVerdict(
      summary([pod()], { healthyServers: 0, trafficRps: 0 }),
      t
    )
    expect(v.tone).toBe("healthy")
  })

  it("surfaces restarts once the pod is otherwise healthy", () => {
    const v = resolveHealthVerdict(
      summary([pod({ restarts: 3 })], { healthyServers: 1 }),
      t
    )
    expect(v.headline).toBe("restarting")
  })

  it("prefers a real outage over a softer restart warning", () => {
    const v = resolveHealthVerdict(
      summary([pod({ status: "Failed", restarts: 9 })], { healthyServers: 0 }),
      t
    )
    expect(v.tone).toBe("down")
  })

  it("reports deploying when stack status is BUILDING, QUEUED, or DEPLOYING", () => {
    for (const status of [
      "BUILDING",
      "building",
      "QUEUED",
      "queued",
      "DEPLOYING",
      "deploying",
    ]) {
      const v = resolveHealthVerdict(
        summary([pod()], { healthyServers: 1 }),
        t,
        status
      )
      expect(v.tone).toBe("deploying")
      expect(v.headline).toBe("deploying")
      expect(v.detail).toBe("deployingDetail")
    }
  })

  it("renders AppOverviewTab with enterprise hero card and vital gauges", () => {
    const mockStack: StackSummaryDTO = {
      id: "stack-123",
      name: "Phoenix Production",
      slug: "phoenix-prod",
      status: "running",
      framework: "Laravel 13.x",
      branchName: "main",
      subdomain: "phoenix-prod.sg.pfnapp.dev",
      customDomain: "phoenix.my.id",
      resourcePlanId: "medium",
      billingMode: "PAYG",
      billingState: "ACTIVE",
      catalogPlanName: "Medium Plan",
      catalogPlanPrice: "40000",
      catalogPlanCurrency: "IDR",
      cpu: 1,
      memory: 2048,
      envCount: 5,
      port: 8080,
      lastDeployedAt: new Date().toISOString(),
      latestDeploymentId: "dep-1",
      currentStepLabel: "Live",
      currentStepIndex: 4,
      currentStepStartedAt: new Date().toISOString(),
    }

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    const view = render(
      <QueryClientProvider client={queryClient}>
        <AppOverviewTab stack={mockStack} locale="id" />
      </QueryClientProvider>
    )

    // Hero title & domain
    expect(view.getByText("Phoenix Production")).toBeDefined()
    expect(view.getByText("https://phoenix.my.id")).toBeDefined()

    // Hero plan & status
    expect(view.getByText("Medium Plan")).toBeDefined()
    expect(view.getByText(/\(Rp 40\.000 \/ bulan\)/i)).toBeDefined()

    // Vital gauges
    expect(view.getByText("Penggunaan CPU")).toBeDefined()
    expect(view.getByText("Penggunaan Memori (RAM)")).toBeDefined()
    expect(view.getByText("Throughput Jaringan")).toBeDefined()

    // Technical collapsible section
    expect(
      view.getByText("Spesifikasi Teknis & Jaringan Internal")
    ).toBeDefined()
  })
})
