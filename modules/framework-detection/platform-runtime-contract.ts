export type RuntimeTunable = {
  key: string
  label: string
  type: "bytes_string" | "string" | "number" | "select" | "boolean"
  default: string | number | boolean
  description: string
  troubleshooting: string
  relatedKeys?: string[]
  options?: string[]
}

export type PlatformRuntimeContract = {
  frameworkId: string
  containerPort: number
  runAsNonRoot: boolean
  runAsUser: number
  runAsGroup: number
  allowPrivilegeEscalation: boolean
  capabilitiesDrop: string[]
  livenessProbe: {
    path: string
    port: number
  }
  readinessProbe: {
    path: string
    port: number
  }
  tunables: RuntimeTunable[]
}

export const PLATFORM_RUNTIME_CONTRACTS: Record<string, PlatformRuntimeContract> = {
  laravel: {
    frameworkId: "laravel",
    containerPort: 8080,
    runAsNonRoot: true,
    runAsUser: 10001,
    runAsGroup: 10001,
    allowPrivilegeEscalation: false,
    capabilitiesDrop: ["ALL"],
    livenessProbe: {
      path: "/healthz",
      port: 8080,
    },
    readinessProbe: {
      path: "/healthz",
      port: 8080,
    },
    tunables: [
      {
        key: "PHP_UPLOAD_MAX_FILESIZE",
        label: "Max Upload Size",
        type: "bytes_string",
        default: "64M",
        description: "Batas ukuran maksimal file yang bisa diupload ke aplikasi PHP.",
        troubleshooting:
          "Jika upload ditolak HTTP 413 (Payload Too Large), naikkan nilai ini bersamaan dengan PHP_POST_MAX_SIZE (misal: 100M).",
        relatedKeys: ["PHP_POST_MAX_SIZE"],
      },
      {
        key: "PHP_POST_MAX_SIZE",
        label: "Max HTTP POST Body",
        type: "bytes_string",
        default: "64M",
        description: "Batas maksimal seluruh payload POST body ke aplikasi.",
        troubleshooting:
          "Harus bernilai sama atau lebih besar dari PHP_UPLOAD_MAX_FILESIZE.",
      },
      {
        key: "PHP_MEMORY_LIMIT",
        label: "PHP Memory Limit",
        type: "bytes_string",
        default: "256M",
        description: "Batas alokasi memori untuk satu proses PHP.",
        troubleshooting:
          "Jika proses gagal dengan error 'Allowed memory size exhausted', naikkan ke 512M.",
      },
      {
        key: "CONTAINER_ROLE",
        label: "Container Workload Role",
        type: "select",
        default: "app",
        options: ["app", "worker", "horizon", "scheduler", "all"],
        description: "Peran eksekusi container di Kubernetes.",
        troubleshooting:
          "Gunakan 'worker' untuk queue background worker, 'horizon' untuk Redis Horizon, dan 'scheduler' untuk cron schedule tanpa perlu Dockerfile baru.",
      },
      {
        key: "PORT",
        label: "Server Port",
        type: "number",
        default: 8080,
        description: "Port internal container (default unprivileged 8080).",
        troubleshooting:
          "Base image platform berjalan di port 8080 sebagai unprivileged user.",
      },
    ],
  },
  nextjs: {
    frameworkId: "nextjs",
    containerPort: 8080,
    runAsNonRoot: true,
    runAsUser: 10001,
    runAsGroup: 10001,
    allowPrivilegeEscalation: false,
    capabilitiesDrop: ["ALL"],
    livenessProbe: {
      path: "/",
      port: 8080,
    },
    readinessProbe: {
      path: "/",
      port: 8080,
    },
    tunables: [
      {
        key: "PORT",
        label: "Server Port",
        type: "number",
        default: 8080,
        description: "Port HTTP server Next.js (default 8080).",
        troubleshooting:
          "Base image Next.js platform otomatis berjalan di port unprivileged 8080.",
      },
      {
        key: "NODE_ENV",
        label: "Node Environment",
        type: "string",
        default: "production",
        description: "Mode runtime Node.js.",
        troubleshooting: "Selalu set ke 'production' untuk performa optimal.",
      },
    ],
  },
  bun: {
    frameworkId: "bun",
    containerPort: 8080,
    runAsNonRoot: true,
    runAsUser: 10001,
    runAsGroup: 10001,
    allowPrivilegeEscalation: false,
    capabilitiesDrop: ["ALL"],
    livenessProbe: {
      path: "/",
      port: 8080,
    },
    readinessProbe: {
      path: "/",
      port: 8080,
    },
    tunables: [
      {
        key: "PORT",
        label: "Server Port",
        type: "number",
        default: 8080,
        description: "Port HTTP server Bun (default 8080).",
        troubleshooting:
          "Base image Bun platform mendengarkan di port 8080 secara unprivileged.",
      },
      {
        key: "BUN_ENV",
        label: "Bun Environment",
        type: "string",
        default: "production",
        description: "Mode runtime Bun.",
        troubleshooting: "Set ke 'production' untuk optimalisasi runtime Bun.",
      },
    ],
  },
  node: {
    frameworkId: "node",
    containerPort: 8080,
    runAsNonRoot: true,
    runAsUser: 10001,
    runAsGroup: 10001,
    allowPrivilegeEscalation: false,
    capabilitiesDrop: ["ALL"],
    livenessProbe: {
      path: "/",
      port: 8080,
    },
    readinessProbe: {
      path: "/",
      port: 8080,
    },
    tunables: [
      {
        key: "PORT",
        label: "Server Port",
        type: "number",
        default: 8080,
        description: "Port HTTP server Node.js (default 8080).",
        troubleshooting: "Mendengarkan di port unprivileged 8080.",
      },
      {
        key: "NODE_ENV",
        label: "Node Environment",
        type: "string",
        default: "production",
        description: "Mode runtime Node.js.",
        troubleshooting: "Set ke 'production' untuk lingkungan produksi.",
      },
    ],
  },
}

export const DEFAULT_PLATFORM_CONTRACT: PlatformRuntimeContract = {
  frameworkId: "default",
  containerPort: 8080,
  runAsNonRoot: true,
  runAsUser: 10001,
  runAsGroup: 10001,
  allowPrivilegeEscalation: false,
  capabilitiesDrop: ["ALL"],
  livenessProbe: {
    path: "/",
    port: 8080,
  },
  readinessProbe: {
    path: "/",
    port: 8080,
  },
  tunables: [
    {
      key: "PORT",
      label: "Server Port",
      type: "number",
      default: 8080,
      description: "Port HTTP server (default 8080).",
      troubleshooting: "Container platform berjalan di port unprivileged 8080.",
    },
  ],
}

export function normalizeFrameworkId(raw?: string | null): string {
  if (!raw) return "default"
  const cleaned = raw.toLowerCase().trim()
  if (cleaned.includes("laravel")) return "laravel"
  if (cleaned.includes("next")) return "nextjs"
  if (cleaned.includes("bun")) return "bun"
  if (cleaned.includes("node") || cleaned.includes("express") || cleaned.includes("nest")) {
    return "node"
  }
  return cleaned
}

export function resolvePlatformContract(
  frameworkId?: string | null
): PlatformRuntimeContract {
  const normalized = normalizeFrameworkId(frameworkId)
  return PLATFORM_RUNTIME_CONTRACTS[normalized] ?? DEFAULT_PLATFORM_CONTRACT
}

export function getRuntimeTunableKnowledge(
  frameworkId?: string | null
): RuntimeTunable[] {
  const contract = resolvePlatformContract(frameworkId)
  return contract.tunables
}

export function formatTunablesForAiPrompt(
  frameworkId?: string | null
): string {
  const contract = resolvePlatformContract(frameworkId)
  const lines: string[] = [
    `Platform Runtime Operational Contract for '${contract.frameworkId}':`,
    `- Container Port: ${contract.containerPort} (Strictly unprivileged UID ${contract.runAsUser})`,
    `- Liveness & Readiness Probes: ${contract.livenessProbe.path} on port ${contract.livenessProbe.port}`,
    `- Configurable Runtime Environment Variables:`,
  ]

  for (const t of contract.tunables) {
    const opts = t.options ? ` [Options: ${t.options.join(", ")}]` : ""
    lines.push(
      `  • ${t.key} (default: ${t.default})${opts}: ${t.description} -> ${t.troubleshooting}`
    )
  }

  return lines.join("\n")
}
