import { describe, expect, it } from "bun:test"
import { resolveHealthVerdict } from "./app-overview-tab"
import type {
  ClusterTelemetrySummary,
  PodMetricSummary,
  PodStatusState,
} from "@/modules/deploy/telemetry.types"

const t = {
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
})
