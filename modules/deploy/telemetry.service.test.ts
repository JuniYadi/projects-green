import { describe, expect, it } from "bun:test"

import {
  CPU_LIMIT_CORES,
  DEFAULT_CLUSTER_CODE,
  formatBytes,
  formatCores,
  formatThroughput,
  generateClusterTelemetrySummary,
  MEMORY_LIMIT_BYTES,
} from "./telemetry.service"

describe("telemetry.service formatters", () => {
  describe("formatBytes", () => {
    it("handles zero, negative, and invalid values", () => {
      expect(formatBytes(0)).toBe("0 B")
      expect(formatBytes(-100)).toBe("0 B")
      expect(formatBytes(Number.NaN)).toBe("0 B")
    })

    it("formats bytes accurately", () => {
      expect(formatBytes(500)).toBe("500 B")
    })

    it("formats kilobytes with realistic examples", () => {
      expect(formatBytes(850 * 1024)).toBe("850 KB")
      expect(formatBytes(1024)).toBe("1 KB")
    })

    it("formats megabytes with realistic examples", () => {
      expect(formatBytes(512 * 1024 * 1024)).toBe("512 MB")
      expect(formatBytes(1.5 * 1024 * 1024)).toBe("1.5 MB")
    })

    it("formats gigabytes with realistic examples", () => {
      expect(formatBytes(2.4 * 1024 * 1024 * 1024)).toBe("2.4 GB")
      expect(formatBytes(8 * 1024 * 1024 * 1024)).toBe("8 GB")
    })

    it("respects custom decimals parameter", () => {
      const bytes = 2.456 * 1024 * 1024 * 1024
      expect(formatBytes(bytes, 2)).toBe("2.46 GB")
      expect(formatBytes(bytes, 0)).toBe("2 GB")
    })
  })

  describe("formatCores", () => {
    it("handles zero and negative values", () => {
      expect(formatCores(0)).toBe("0 vCPU")
      expect(formatCores(-1)).toBe("0 vCPU")
      expect(formatCores(Number.NaN)).toBe("0 vCPU")
    })

    it("formats integer core limits without decimals", () => {
      expect(formatCores(4)).toBe("4 vCPU")
      expect(formatCores(8)).toBe("8 vCPU")
    })

    it("formats fractional core usage with decimals", () => {
      expect(formatCores(2.1)).toBe("2.1 vCPU")
      expect(formatCores(1.25)).toBe("1.25 vCPU")
      expect(formatCores(3.38)).toBe("3.38 vCPU")
    })
  })

  describe("formatThroughput", () => {
    it("handles zero throughput", () => {
      expect(formatThroughput(0)).toBe("0 B/s")
    })

    it("formats throughput in KB/s and MB/s", () => {
      expect(formatThroughput(850 * 1024)).toBe("850 KB/s")
      expect(formatThroughput(1.2 * 1024 * 1024)).toBe("1.2 MB/s")
      expect(formatThroughput(6.2 * 1024 * 1024)).toBe("6.2 MB/s")
    })
  })
})

describe("generateClusterTelemetrySummary", () => {
  it("generates default 1h summary for primary cluster id-cgk-1", () => {
    const summary = generateClusterTelemetrySummary()

    expect(summary.clusterId).toBe(DEFAULT_CLUSTER_CODE)
    expect(summary.clusterName).toBe("Jakarta Production Cluster")
    expect(summary.region).toBe("Jakarta (id-cgk-1)")
    expect(summary.isPrimary).toBe(true)
    expect(summary.timeRange).toBe("1h")
    expect(summary.points).toHaveLength(12)
  })

  it("handles different time ranges (6h, 24h) with 12 points", () => {
    const summary6h = generateClusterTelemetrySummary("6h")
    expect(summary6h.timeRange).toBe("6h")
    expect(summary6h.points).toHaveLength(12)
    expect(summary6h.points[0].timestamp).toBe("07:30")
    expect(summary6h.points[11].timestamp).toBe("13:00")

    const summary24h = generateClusterTelemetrySummary("24h")
    expect(summary24h.timeRange).toBe("24h")
    expect(summary24h.points).toHaveLength(12)
    expect(summary24h.points[0].timestamp).toBe("15:00")
    expect(summary24h.points[11].timestamp).toBe("13:00")
  })

  it("handles non-primary cluster codes and custom clusters", () => {
    const sgSummary = generateClusterTelemetrySummary("1h", "sg-sin-1")
    expect(sgSummary.clusterId).toBe("sg-sin-1")
    expect(sgSummary.clusterName).toBe("Singapore Edge Cluster")
    expect(sgSummary.region).toBe("Singapore (sg-sin-1)")
    expect(sgSummary.isPrimary).toBe(false)

    const customSummary = generateClusterTelemetrySummary("1h", "us-east-1")
    expect(customSummary.clusterId).toBe("us-east-1")
    expect(customSummary.clusterName).toBe("Cluster (us-east-1)")
    expect(customSummary.region).toBe("us-east-1")
    expect(customSummary.isPrimary).toBe(false)
  })

  it("ensures all points stay strictly within required metric bounds", () => {
    const timeRanges: Array<"1h" | "6h" | "24h"> = ["1h", "6h", "24h"]
    const minBytes = 2.1 * 1024 * 1024 * 1024
    const maxBytes = 3.2 * 1024 * 1024 * 1024
    const minRx = 600 * 1024
    const maxRx = 2.4 * 1024 * 1024
    const minTx = 1.8 * 1024 * 1024
    const maxTx = 6.2 * 1024 * 1024

    for (const tr of timeRanges) {
      const summary = generateClusterTelemetrySummary(tr)

      expect(summary.points).toHaveLength(12)
      for (const point of summary.points) {
        expect(point.cpuLimitCores).toBe(CPU_LIMIT_CORES)
        expect(point.cpuUsageCores).toBeGreaterThanOrEqual(1.2)
        expect(point.cpuUsageCores).toBeLessThanOrEqual(3.4)

        expect(point.memoryLimitBytes).toBe(MEMORY_LIMIT_BYTES)
        expect(point.memoryUsageBytes).toBeGreaterThanOrEqual(minBytes)
        expect(point.memoryUsageBytes).toBeLessThanOrEqual(maxBytes)

        expect(point.networkRxBytesPerSec).toBeGreaterThanOrEqual(minRx)
        expect(point.networkRxBytesPerSec).toBeLessThanOrEqual(maxRx)

        expect(point.networkTxBytesPerSec).toBeGreaterThanOrEqual(minTx)
        expect(point.networkTxBytesPerSec).toBeLessThanOrEqual(maxTx)
      }
    }
  })

  it("correctly computes current, limit, average, and peak metrics", () => {
    const summary = generateClusterTelemetrySummary("1h")
    const lastPoint = summary.points[summary.points.length - 1]

    // CPU checks
    expect(summary.cpu.currentCores).toBe(lastPoint.cpuUsageCores)
    expect(summary.cpu.limitCores).toBe(CPU_LIMIT_CORES)
    const expectedAvgCpu = Number(
      (
        summary.points.reduce((sum, p) => sum + p.cpuUsageCores, 0) /
        summary.points.length
      ).toFixed(2)
    )
    expect(summary.cpu.avgCores).toBe(expectedAvgCpu)
    const expectedPeakCpu = Math.max(
      ...summary.points.map((p) => p.cpuUsageCores)
    )
    expect(summary.cpu.peakCores).toBe(expectedPeakCpu)

    // Memory checks
    expect(summary.memory.currentBytes).toBe(lastPoint.memoryUsageBytes)
    expect(summary.memory.limitBytes).toBe(MEMORY_LIMIT_BYTES)
    const expectedAvgMem = Math.round(
      summary.points.reduce((sum, p) => sum + p.memoryUsageBytes, 0) /
        summary.points.length
    )
    expect(summary.memory.avgBytes).toBe(expectedAvgMem)
    const expectedPeakMem = Math.max(
      ...summary.points.map((p) => p.memoryUsageBytes)
    )
    expect(summary.memory.peakBytes).toBe(expectedPeakMem)

    // Network checks
    expect(summary.network.currentRxBytes).toBe(lastPoint.networkRxBytesPerSec)
    expect(summary.network.currentTxBytes).toBe(lastPoint.networkTxBytesPerSec)
    const intervalSeconds = 300 // 1h has 300s step
    const expectedTotalRx = Math.round(
      summary.points.reduce(
        (sum, p) => sum + p.networkRxBytesPerSec * intervalSeconds,
        0
      )
    )
    const expectedTotalTx = Math.round(
      summary.points.reduce(
        (sum, p) => sum + p.networkTxBytesPerSec * intervalSeconds,
        0
      )
    )
    expect(summary.network.totalRxBytes).toBe(expectedTotalRx)
    expect(summary.network.totalTxBytes).toBe(expectedTotalTx)
    expect(summary.network.totalRxBytes).toBeGreaterThan(0)
    expect(summary.network.totalTxBytes).toBeGreaterThan(0)
  })

  it("is deterministic across repeated calls with same parameters", () => {
    const run1 = generateClusterTelemetrySummary("1h", "id-cgk-1")
    const run2 = generateClusterTelemetrySummary("1h", "id-cgk-1")
    expect(run1).toEqual(run2)
  })
})
