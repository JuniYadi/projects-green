import type {
  ClusterTelemetrySummary,
  TelemetryDataPoint,
} from "@/modules/deploy/telemetry.types"

export const DEFAULT_CLUSTER_CODE = "id-cgk-1"
export const CPU_LIMIT_CORES = 4.0
export const MEMORY_LIMIT_BYTES = 8 * 1024 * 1024 * 1024 // 8 GB

const CLUSTER_CONFIGS: Record<
  string,
  { clusterName: string; region: string; isPrimary: boolean }
> = {
  "id-cgk-1": {
    clusterName: "Jakarta Production Cluster",
    region: "Jakarta (id-cgk-1)",
    isPrimary: true,
  },
  "sg-sin-1": {
    clusterName: "Singapore Edge Cluster",
    region: "Singapore (sg-sin-1)",
    isPrimary: false,
  },
}

const TIMESTAMPS_BY_RANGE: Record<"1h" | "6h" | "24h" | "7d", string[]> = {
  "1h": [
    "12:05",
    "12:10",
    "12:15",
    "12:20",
    "12:25",
    "12:30",
    "12:35",
    "12:40",
    "12:45",
    "12:50",
    "12:55",
    "13:00",
  ],
  "6h": [
    "07:30",
    "08:00",
    "08:30",
    "09:00",
    "09:30",
    "10:00",
    "10:30",
    "11:00",
    "11:30",
    "12:00",
    "12:30",
    "13:00",
  ],
  "24h": [
    "15:00",
    "17:00",
    "19:00",
    "21:00",
    "23:00",
    "01:00",
    "03:00",
    "05:00",
    "07:00",
    "09:00",
    "11:00",
    "13:00",
  ],
  "7d": ["Day 1", "Day 2", "Day 3", "Day 4", "Day 5", "Day 6", "Day 7"],
}

type ProfileFactors = {
  cpu: number[]
  mem: number[]
  rx: number[]
  tx: number[]
}

const PROFILES: Record<"1h" | "6h" | "24h" | "7d", ProfileFactors> = {
  "1h": {
    cpu: [
      0.12, 0.25, 0.45, 0.68, 0.88, 0.96, 0.78, 0.62, 0.5, 0.74, 0.52, 0.42,
    ],
    mem: [
      0.18, 0.22, 0.35, 0.48, 0.65, 0.82, 0.94, 0.89, 0.79, 0.72, 0.64, 0.58,
    ],
    rx: [0.1, 0.28, 0.55, 0.82, 0.95, 0.88, 0.65, 0.42, 0.35, 0.68, 0.5, 0.38],
    tx: [0.15, 0.32, 0.58, 0.85, 0.98, 0.9, 0.72, 0.48, 0.38, 0.75, 0.54, 0.4],
  },
  "6h": {
    cpu: [0.1, 0.18, 0.3, 0.52, 0.76, 0.92, 0.98, 0.84, 0.65, 0.48, 0.35, 0.44],
    mem: [0.15, 0.2, 0.28, 0.42, 0.58, 0.75, 0.9, 0.96, 0.88, 0.76, 0.68, 0.62],
    rx: [0.12, 0.2, 0.38, 0.65, 0.86, 0.96, 0.9, 0.74, 0.52, 0.38, 0.3, 0.42],
    tx: [0.18, 0.26, 0.45, 0.72, 0.9, 0.98, 0.92, 0.78, 0.58, 0.44, 0.36, 0.48],
  },
  "24h": {
    cpu: [0.08, 0.05, 0.12, 0.28, 0.55, 0.82, 0.95, 0.9, 0.78, 0.62, 0.4, 0.25],
    mem: [
      0.22, 0.18, 0.16, 0.25, 0.45, 0.68, 0.85, 0.92, 0.86, 0.74, 0.55, 0.42,
    ],
    rx: [0.08, 0.06, 0.15, 0.35, 0.62, 0.88, 0.96, 0.86, 0.72, 0.5, 0.32, 0.2],
    tx: [0.12, 0.09, 0.2, 0.42, 0.7, 0.92, 0.98, 0.89, 0.75, 0.55, 0.38, 0.28],
  },
  "7d": {
    cpu: [0.12, 0.25, 0.45, 0.68, 0.88, 0.65, 0.42],
    mem: [0.2, 0.25, 0.4, 0.6, 0.75, 0.7, 0.55],
    rx: [0.15, 0.3, 0.5, 0.7, 0.85, 0.6, 0.4],
    tx: [0.2, 0.35, 0.6, 0.8, 0.9, 0.7, 0.5],
  },
}

// Ranges
const CPU_MIN_CORES = 1.2
const CPU_MAX_CORES = 3.4

const MEM_MIN_BYTES = Math.round(2.1 * 1024 * 1024 * 1024)
const MEM_MAX_BYTES = Math.round(3.2 * 1024 * 1024 * 1024)

const RX_MIN_BYTES_PER_SEC = 600 * 1024
const RX_MAX_BYTES_PER_SEC = Math.round(2.4 * 1024 * 1024)

const TX_MIN_BYTES_PER_SEC = Math.round(1.8 * 1024 * 1024)
const TX_MAX_BYTES_PER_SEC = Math.round(6.2 * 1024 * 1024)

const INTERVAL_SECONDS_BY_RANGE: Record<"1h" | "6h" | "24h" | "7d", number> = {
  "1h": 300,
  "6h": 1800,
  "24h": 7200,
  "7d": 86400,
}

export function formatBytes(bytes: number, decimals?: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B"
  }
  const units = ["B", "KB", "MB", "GB", "TB", "PB"] as const
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  )
  const value = bytes / 1024 ** exponent
  if (exponent === 0) {
    return `${Math.round(value)} B`
  }
  if (decimals !== undefined) {
    return `${value.toFixed(decimals)} ${units[exponent]}`
  }
  const dec = value >= 100 ? 0 : 1
  const formatted = value % 1 === 0 ? value.toString() : value.toFixed(dec)
  return `${formatted} ${units[exponent]}`
}

export function formatCores(cores: number): string {
  if (!Number.isFinite(cores) || cores <= 0) {
    return "0 vCPU"
  }
  const formatted = Number.isInteger(cores)
    ? cores.toString()
    : Number(cores.toFixed(2)).toString()
  return `${formatted} vCPU`
}

export function formatThroughput(bytesPerSec: number): string {
  return `${formatBytes(bytesPerSec)}/s`
}

export function generateClusterTelemetrySummary(
  timeRange: "1h" | "6h" | "24h" | "7d" = "1h",
  clusterCode: string = DEFAULT_CLUSTER_CODE
): ClusterTelemetrySummary {
  const isPrimary = clusterCode === DEFAULT_CLUSTER_CODE
  const clusterMeta = CLUSTER_CONFIGS[clusterCode] ?? {
    clusterName: `Cluster (${clusterCode})`,
    region: clusterCode,
    isPrimary,
  }

  const timestamps = TIMESTAMPS_BY_RANGE[timeRange]
  const profile = PROFILES[timeRange]

  const points: TelemetryDataPoint[] = timestamps.map((timestamp, index) => {
    const cpuFactor = profile.cpu[index]
    const memFactor = profile.mem[index]
    const rxFactor = profile.rx[index]
    const txFactor = profile.tx[index]

    const cpuUsageCores = Number(
      (CPU_MIN_CORES + cpuFactor * (CPU_MAX_CORES - CPU_MIN_CORES)).toFixed(2)
    )
    const memoryUsageBytes = Math.round(
      MEM_MIN_BYTES + memFactor * (MEM_MAX_BYTES - MEM_MIN_BYTES)
    )
    const networkRxBytesPerSec = Math.round(
      RX_MIN_BYTES_PER_SEC +
        rxFactor * (RX_MAX_BYTES_PER_SEC - RX_MIN_BYTES_PER_SEC)
    )
    const networkTxBytesPerSec = Math.round(
      TX_MIN_BYTES_PER_SEC +
        txFactor * (TX_MAX_BYTES_PER_SEC - TX_MIN_BYTES_PER_SEC)
    )

    return {
      timestamp,
      cpuUsageCores,
      cpuLimitCores: CPU_LIMIT_CORES,
      memoryUsageBytes,
      memoryLimitBytes: MEMORY_LIMIT_BYTES,
      networkRxBytesPerSec,
      networkTxBytesPerSec,
    }
  })

  const lastPoint = points[points.length - 1]
  const cpuValues = points.map((p) => p.cpuUsageCores)
  const memValues = points.map((p) => p.memoryUsageBytes)
  const rxValues = points.map((p) => p.networkRxBytesPerSec)
  const txValues = points.map((p) => p.networkTxBytesPerSec)

  const avgCores = Number(
    (cpuValues.reduce((sum, v) => sum + v, 0) / points.length).toFixed(2)
  )
  const peakCores = Math.max(...cpuValues)

  const avgBytes = Math.round(
    memValues.reduce((sum, v) => sum + v, 0) / points.length
  )
  const peakBytes = Math.max(...memValues)

  const intervalSeconds = INTERVAL_SECONDS_BY_RANGE[timeRange]
  const totalRxBytes = Math.round(
    rxValues.reduce((sum, rate) => sum + rate * intervalSeconds, 0)
  )
  const totalTxBytes = Math.round(
    txValues.reduce((sum, rate) => sum + rate * intervalSeconds, 0)
  )

  return {
    clusterId: clusterCode,
    clusterName: clusterMeta.clusterName,
    region: clusterMeta.region,
    isPrimary: clusterMeta.isPrimary,
    timeRange,
    points,
    cpu: {
      currentCores: lastPoint.cpuUsageCores,
      limitCores: CPU_LIMIT_CORES,
      avgCores,
      peakCores,
    },
    memory: {
      currentBytes: lastPoint.memoryUsageBytes,
      limitBytes: MEMORY_LIMIT_BYTES,
      avgBytes,
      peakBytes,
    },
    network: {
      currentRxBytes: lastPoint.networkRxBytesPerSec,
      currentTxBytes: lastPoint.networkTxBytesPerSec,
      totalRxBytes,
      totalTxBytes,
    },
    pods: [
      {
        pod: "workload-deploy-0",
        cpuUsageCores: lastPoint.cpuUsageCores,
        cpuLimitCores: CPU_LIMIT_CORES,
        cpuPercent: Math.min(
          100,
          Math.round((lastPoint.cpuUsageCores / CPU_LIMIT_CORES) * 100)
        ),
        memoryUsageBytes: lastPoint.memoryUsageBytes,
        memoryLimitBytes: MEMORY_LIMIT_BYTES,
        memoryPercent: Math.min(
          100,
          Math.round((lastPoint.memoryUsageBytes / MEMORY_LIMIT_BYTES) * 100)
        ),
        restarts: 0,
        status: "Running",
      },
    ],
  }
}
