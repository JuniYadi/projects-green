"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import {
  Globe,
  Key,
  Terminal as TerminalIcon,
  Cpu,
  ArrowsLeftRight,
  Plus,
  Trash,
  Eye,
  EyeSlash,
  ArrowClockwise,
  Warning,
  CheckCircle,
  Info,
  ShieldWarning,
  ShieldCheck,
  Lightning,
  Pulse,
  HardDrive,
  MagnifyingGlass,
  ArrowSquareOut,
  Question,
  Wrench,
  BookOpen,
  ArrowRight
} from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"

type K8sEnvironmentId = "dev" | "staging" | "prod"

type K8sEnvironment = {
  id: K8sEnvironmentId
  label: string
  description: string
  color: string
}

const K8S_ENVIRONMENTS: K8sEnvironment[] = [
  { id: "dev", label: "Development", description: "Internal sandbox", color: "text-blue-500 bg-blue-500/10 border-blue-500/20" },
  { id: "staging", label: "Staging", description: "Pre-prod verification", color: "text-yellow-500 bg-yellow-500/10 border-yellow-500/20" },
  { id: "prod", label: "Production", description: "Live client traffic", color: "text-green-500 bg-green-500/10 border-green-500/20" },
]

type AppStatusType = "healthy" | "degraded" | "inaccessible" | "deploying"

type CustomDomain = {
  id: string
  domain: string
  isPrimary: boolean
  tlsStatus: "active" | "expired" | "pending"
  dnsStatus: "verified" | "unverified"
  expiresAt: string
}

type EnvVar = {
  id: string
  key: string
  value: string
  isSecret: boolean
  updatedAt: string
}

type VolumeMount = {
  id: string
  name: string
  mountPath: string
  sourceType: "secret" | "configmap"
  fileMode: string
  readOnly: boolean
  contentSummary: string
}

type LogMessage = {
  timestamp: string
  level: "INFO" | "WARN" | "ERROR"
  source: string
  message: string
}

const INITIAL_DOMAINS: Record<K8sEnvironmentId, CustomDomain[]> = {
  dev: [
    { id: "dom-1", domain: "laravel-shop-dev.projects-green.dev", isPrimary: true, tlsStatus: "active", dnsStatus: "verified", expiresAt: "2026-08-20" }
  ],
  staging: [
    { id: "dom-2", domain: "staging.laravelshop.com", isPrimary: true, tlsStatus: "active", dnsStatus: "verified", expiresAt: "2026-08-15" }
  ],
  prod: [
    { id: "dom-3", domain: "laravelshop.com", isPrimary: true, tlsStatus: "active", dnsStatus: "verified", expiresAt: "2026-08-01" },
    { id: "dom-4", domain: "www.laravelshop.com", isPrimary: false, tlsStatus: "expired", dnsStatus: "verified", expiresAt: "2026-05-18" }
  ]
}

const INITIAL_ENV_VARS: Record<K8sEnvironmentId, EnvVar[]> = {
  dev: [
    { id: "env-1", key: "APP_NAME", value: "LaravelShop Sandbox", isSecret: false, updatedAt: "2026-05-20" },
    { id: "env-2", key: "APP_ENV", value: "local", isSecret: false, updatedAt: "2026-05-20" },
    { id: "env-3", key: "APP_DEBUG", value: "true", isSecret: false, updatedAt: "2026-05-20" },
    { id: "env-4", key: "DB_CONNECTION", value: "mysql", isSecret: false, updatedAt: "2026-05-20" },
    { id: "env-5", key: "DB_PASSWORD", value: "supersecretdevpassword", isSecret: true, updatedAt: "2026-05-20" }
  ],
  staging: [
    { id: "env-6", key: "APP_NAME", value: "LaravelShop Staging", isSecret: false, updatedAt: "2026-05-19" },
    { id: "env-7", key: "APP_ENV", value: "staging", isSecret: false, updatedAt: "2026-05-19" },
    { id: "env-8", key: "APP_DEBUG", value: "false", isSecret: false, updatedAt: "2026-05-19" },
    { id: "env-9", key: "TRUST_PROXIES", value: "*", isSecret: false, updatedAt: "2026-05-19" },
    { id: "env-10", key: "DB_PASSWORD", value: "stagingdbpass2026", isSecret: true, updatedAt: "2026-05-19" }
  ],
  prod: [
    { id: "env-11", key: "APP_NAME", value: "LaravelShop Live", isSecret: false, updatedAt: "2026-05-15" },
    { id: "env-12", key: "APP_ENV", value: "production", isSecret: false, updatedAt: "2026-05-15" },
    { id: "env-13", key: "APP_DEBUG", value: "false", isSecret: false, updatedAt: "2026-05-15" },
    { id: "env-14", key: "DB_PASSWORD", value: "prod-secure-db-password-998", isSecret: true, updatedAt: "2026-05-15" },
    { id: "env-15", key: "APP_KEY", value: "base64:fHsdjKJHDF2378sdjhfkjsdfhsiuhu128=", isSecret: true, updatedAt: "2026-05-15" }
  ]
}

const INITIAL_MOUNTS: Record<K8sEnvironmentId, VolumeMount[]> = {
  dev: [
    { id: "mnt-1", name: "dev-secrets-pem", mountPath: "/var/www/html/storage/app/key.pem", sourceType: "secret", fileMode: "0400", readOnly: true, contentSummary: "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQD... (640 bytes)" }
  ],
  staging: [
    { id: "mnt-2", name: "staging-cert-pem", mountPath: "/var/www/html/storage/app/cert.pem", sourceType: "secret", fileMode: "0400", readOnly: true, contentSummary: "-----BEGIN CERTIFICATE-----\nMIIDezCCAmOgAwIBAgIUa7R5VfP... (1200 bytes)" }
  ],
  prod: [
    { id: "mnt-3", name: "prod-api-private-key", mountPath: "/var/www/html/storage/app/private_key.pem", sourceType: "secret", fileMode: "0400", readOnly: true, contentSummary: "-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA3T7mYw5Gq... (1672 bytes)" }
  ]
}

const INITIAL_LOGS: LogMessage[] = [
  { timestamp: "17:54:10", level: "INFO", source: "nginx", message: "Starting nginx/1.25.3 worker process" },
  { timestamp: "17:54:11", level: "INFO", source: "php-fpm", message: "fpm is running, ready to handle requests on port 9000" },
  { timestamp: "17:54:12", level: "INFO", source: "app", message: "Laravel service container booted successfully. Environment: production" },
  { timestamp: "17:54:15", level: "INFO", source: "database", message: "MySQL connection pool initialized. 12 active connections" },
  { timestamp: "17:54:30", level: "INFO", source: "nginx", message: "172.19.0.4 - \"GET / HTTP/1.1\" 200 4528 \"-\" \"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)\"" },
  { timestamp: "17:54:32", level: "INFO", source: "app", message: "SQL query completed (1.2ms): SELECT * FROM settings WHERE name = 'theme' LIMIT 1" },
  { timestamp: "17:54:40", level: "WARN", source: "php-fpm", message: "Child process 42 exceeded execution timeout limit (60s). Terminated." },
  { timestamp: "17:54:41", level: "INFO", source: "nginx", message: "172.19.0.4 - \"GET /api/v1/products HTTP/1.1\" 504 182 \"-\" \"Mozilla/5.0\"" },
  { timestamp: "17:54:45", level: "ERROR", source: "app", message: "Redis connection failed. Host 'redis-cache-prod' is unreachable. Retrying in 5s..." }
]

export default function OperatePage() {
  const [selectedEnv, setSelectedEnv] = useState<K8sEnvironmentId>("prod")
  const [activeTab, setActiveTab] = useState<string>("overview")

  // Troubleshooter drawer/modal
  const [isTroubleshooterOpen, setIsTroubleshooterOpen] = useState(false)
  const [troubleshooterSearch, setTroubleshooterSearch] = useState("")

  // Simulation controls (for demonstrating issues live)
  const [diagnosticMode, setDiagnosticMode] = useState<string>("healthy")

  // State maps
  const [domains, setDomains] = useState<Record<K8sEnvironmentId, CustomDomain[]>>(INITIAL_DOMAINS)
  const [envVars, setEnvVars] = useState<Record<K8sEnvironmentId, EnvVar[]>>(INITIAL_ENV_VARS)
  const [mounts, setMounts] = useState<Record<K8sEnvironmentId, VolumeMount[]>>(INITIAL_MOUNTS)
  const [logs, setLogs] = useState<LogMessage[]>(INITIAL_LOGS)

  // Subsystem states
  const [rebuildState, setRebuildState] = useState<"idle" | "fetching" | "building" | "restarting" | "success">("idle")
  const [buildLogs, setBuildLogs] = useState<string[]>([])
  const [healthStatus, setHealthStatus] = useState<AppStatusType>("healthy")

  // Form states - Env Vars
  const [newEnvKey, setNewEnvKey] = useState("")
  const [newEnvVal, setNewEnvVal] = useState("")
  const [newEnvSecret, setNewEnvSecret] = useState(false)
  const [bulkEnvText, setBulkEnvText] = useState("")
  const [isBulkOpen, setIsBulkOpen] = useState(false)
  const [visibleSecrets, setVisibleSecrets] = useState<Record<string, boolean>>({})

  // Form states - Domains
  const [newDomain, setNewDomain] = useState("")
  const [newDomainTls, setNewDomainTls] = useState<"active" | "expired" | "pending">("active")

  // Form states - Mounts
  const [newMountName, setNewMountName] = useState("")
  const [newMountPath, setNewMountPath] = useState("")
  const [newMountContent, setNewMountContent] = useState("")
  const [newMountReadOnly, setNewMountReadOnly] = useState(true)
  const [mountError, setMountError] = useState("")

  // Reverse Proxy state
  const [trustProxy, setTrustProxy] = useState(false)

  // Cloudflare details state
  const [cloudflareProxied, setCloudflareProxied] = useState(true)
  const [cloudflareSslMode, setCloudflareSslMode] = useState<"flexible" | "full" | "strict">("flexible")

  // Scaling / CPU / RAM Tuning state
  const [cpuRequest, setCpuRequest] = useState("500m")
  const [cpuLimit, setCpuLimit] = useState("1000m")
  const [memRequest, setMemRequest] = useState("256Mi")
  const [memLimit, setMemLimit] = useState("512Mi")
  const [replicas, setReplicas] = useState(2)

  // HPA & VPA state
  const [hpaEnabled, setHpaEnabled] = useState(false)
  const [hpaMinReplicas, setHpaMinReplicas] = useState(2)
  const [hpaMaxReplicas, setHpaMaxReplicas] = useState(8)
  const [hpaCpuTarget, setHpaCpuTarget] = useState(75)

  const [vpaEnabled, setVpaEnabled] = useState(false)
  const [vpaMode, setVpaMode] = useState<"Off" | "Initial" | "Auto">("Auto")

  // Logs state
  const [logFilterQuery, setLogFilterQuery] = useState("")
  const [logFilterLevel, setLogFilterLevel] = useState<"ALL" | "INFO" | "WARN" | "ERROR">("ALL")
  const [isLiveTailing, setIsLiveTailing] = useState(true)

  const logConsoleEndRef = useRef<HTMLDivElement>(null)

  // Synchronize health state based on diagnostics simulation
  useEffect(() => {
    if (diagnosticMode === "healthy") {
      setHealthStatus("healthy")
    } else if (diagnosticMode === "error_502") {
      setHealthStatus("degraded")
    } else if (diagnosticMode === "ssl_expired") {
      setHealthStatus("inaccessible")
    } else if (diagnosticMode === "redirect_loop") {
      setHealthStatus("degraded")
    }
  }, [diagnosticMode])

  // Simulate logs tick
  useEffect(() => {
    if (!isLiveTailing) return

    const interval = setInterval(() => {
      const now = new Date()
      const timestamp = now.toTimeString().split(" ")[0]

      const randomLogs: LogMessage[] = [
        { timestamp, level: "INFO", source: "nginx", message: `172.19.0.4 - "GET /api/v1/health HTTP/1.1" 200 42 "-"` },
        { timestamp, level: "INFO", source: "app", message: "Resolved route: Api\\HealthController@check" },
        { timestamp, level: "INFO", source: "database", message: "SQL query completed (0.4ms): SELECT 1" }
      ]

      if (diagnosticMode === "error_502") {
        randomLogs.push({ timestamp, level: "ERROR", source: "nginx", message: "[error] 14#14: *1534 connect() failed (111: Connection refused) while connecting to upstream, client: 162.158.12.98, server: laravelshop.com, request: \"GET / HTTP/1.1\", upstream: \"http://127.0.0.1:9000/\"" })
      } else if (diagnosticMode === "ssl_expired") {
        randomLogs.push({ timestamp, level: "ERROR", source: "nginx", message: "[crit] 14#14: *1539 SSL_do_handshake() failed (SSL: error:0A0000C4:SSL routines::ssl handshake failure:expired certificate) while SSL handshaking, client: 172.69.7.35" })
      } else if (diagnosticMode === "redirect_loop") {
        randomLogs.push({ timestamp, level: "WARN", source: "nginx", message: "162.158.14.88 - \"GET / HTTP/1.1\" 301 162 \"-\" (Internal redirection loop detected)" })
      }

      const randomSelection = randomLogs[Math.floor(Math.random() * randomLogs.length)]
      setLogs(prev => [...prev.slice(-30), randomSelection]) // keep last 30 logs
    }, 4000)

    return () => clearInterval(interval)
  }, [isLiveTailing, diagnosticMode])

  // Scroll to bottom of logs
  useEffect(() => {
    if (logConsoleEndRef.current && isLiveTailing) {
      logConsoleEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [logs, isLiveTailing])

  // Rebuild Trigger Simulator
  const handleRebuild = () => {
    setRebuildState("fetching")
    setBuildLogs(["[17:55:00] Pulling latest updates from git repository acme/laravel-shop:main..."])

    setTimeout(() => {
      setRebuildState("building")
      setBuildLogs(prev => [...prev,
        "[17:55:02] Found updated commit: d4a7d0e (feat: optimize product loading speed)",
        "[17:55:03] Building container image via Dockerfile...",
        "[17:55:05] Running: composer install --no-dev --optimize-autoloader",
        "[17:55:07] Running: bun install && bun run build",
        "[17:55:09] Injecting environment configurations...",
        "[17:55:10] Container build successful. Image tagged: ghcr.io/acme/laravel-shop:sha-d4a7d0e",
        "[17:55:11] Pushing container to registry... Done"
      ])
    }, 2000)

    setTimeout(() => {
      setRebuildState("restarting")
      setBuildLogs(prev => [...prev,
        "[17:55:13] Scheduling rollout restart for namespace app-prod...",
        "[17:55:14] Deploying 2 replica pods using RollingUpdate strategy...",
        "[17:55:16] Pod app-prod-api-d4a7d0e-x9z10: Starting initialization...",
        "[17:55:17] Pod app-prod-api-d4a7d0e-x9z10: Health checks passed. Pod Ready.",
        "[17:55:18] Terminating old pod replicas..."
      ])
    }, 5000)

    setTimeout(() => {
      setRebuildState("success")
      setBuildLogs(prev => [...prev, "[17:55:20] Deployment completed. Site is healthy and active."])
      setTimeout(() => setRebuildState("idle"), 3000)
    }, 8000)
  }

  // Add Domain
  const handleAddDomain = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newDomain.trim()) return

    const newObj: CustomDomain = {
      id: `dom-${Date.now()}`,
      domain: newDomain.trim(),
      isPrimary: domains[selectedEnv].length === 0,
      tlsStatus: newDomainTls,
      dnsStatus: "unverified",
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
    }

    setDomains(prev => ({
      ...prev,
      [selectedEnv]: [...prev[selectedEnv], newObj]
    }))
    setNewDomain("")
  }

  // Delete Domain
  const handleDeleteDomain = (id: string) => {
    setDomains(prev => ({
      ...prev,
      [selectedEnv]: prev[selectedEnv].filter(d => d.id !== id)
    }))
  }

  // Force renew SSL
  const handleForceSSL = (id: string) => {
    setDomains(prev => ({
      ...prev,
      [selectedEnv]: prev[selectedEnv].map(d => {
        if (d.id === id) {
          return {
            ...d,
            tlsStatus: "active",
            dnsStatus: "verified",
            expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
          }
        }
        return d
      })
    }))
  }

  // Add Env Var
  const handleAddEnv = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newEnvKey.trim()) return

    const newObj: EnvVar = {
      id: `env-${Date.now()}`,
      key: newEnvKey.toUpperCase().replace(/[^A-Z0-9_]/g, ""),
      value: newEnvVal,
      isSecret: newEnvSecret,
      updatedAt: new Date().toISOString().split("T")[0]
    }

    setEnvVars(prev => ({
      ...prev,
      [selectedEnv]: [...prev[selectedEnv], newObj]
    }))
    setNewEnvKey("")
    setNewEnvVal("")
    setNewEnvSecret(false)
  }

  // Delete Env Var
  const handleDeleteEnv = (id: string) => {
    setEnvVars(prev => ({
      ...prev,
      [selectedEnv]: prev[selectedEnv].filter(e => e.id !== id)
    }))
  }

  // Bulk Import Env
  const handleBulkEnvImport = () => {
    if (!bulkEnvText.trim()) return
    const lines = bulkEnvText.split("\n")
    const newVars: EnvVar[] = []
    const now = new Date().toISOString().split("T")[0]

    lines.forEach((line, idx) => {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) return

      const eqIdx = trimmed.indexOf("=")
      if (eqIdx > 0) {
        const key = trimmed.substring(0, eqIdx).trim().toUpperCase().replace(/[^A-Z0-9_]/g, "")
        let val = trimmed.substring(eqIdx + 1).trim()

        // Strip quotes if present
        if ((val.startsWith("\"") && val.endsWith("\"")) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.substring(1, val.length - 1)
        }

        const isSecret = key.includes("PASS") || key.includes("KEY") || key.includes("SECRET") || key.includes("TOKEN")

        newVars.push({
          id: `env-bulk-${idx}-${Date.now()}`,
          key,
          value: val,
          isSecret,
          updatedAt: now
        })
      }
    })

    setEnvVars(prev => ({
      ...prev,
      [selectedEnv]: [...prev[selectedEnv], ...newVars]
    }))
    setBulkEnvText("")
    setIsBulkOpen(false)
  }

  // Add Volume Mount
  const handleAddMount = (e: React.FormEvent) => {
    e.preventDefault()
    setMountError("")

    if (!newMountName.trim() || !newMountPath.trim() || !newMountContent.trim()) {
      setMountError("All fields are required")
      return
    }

    // Guardrail paths
    const forbiddenPaths = ["/bin", "/sbin", "/usr/bin", "/proc", "/sys", "/dev", "/etc/passwd"]
    const startsWithForbidden = forbiddenPaths.some(p => newMountPath.startsWith(p))
    if (startsWithForbidden) {
      setMountError(`Cannot mount to protected directories: ${forbiddenPaths.join(", ")}`)
      return
    }

    if (!newMountPath.startsWith("/")) {
      setMountError("Mount path must be absolute (starting with '/')")
      return
    }

    const newObj: VolumeMount = {
      id: `mnt-${Date.now()}`,
      name: newMountName.trim().toLowerCase().replace(/[^a-z0-9-]/g, ""),
      mountPath: newMountPath.trim(),
      sourceType: "secret",
      fileMode: "0400",
      readOnly: newMountReadOnly,
      contentSummary: newMountContent.slice(0, 45) + (newMountContent.length > 45 ? "..." : "") + ` (${newMountContent.length} bytes)`
    }

    setMounts(prev => ({
      ...prev,
      [selectedEnv]: [...prev[selectedEnv], newObj]
    }))
    setNewMountName("")
    setNewMountPath("")
    setNewMountContent("")
  }

  // Delete Mount
  const handleDeleteMount = (id: string) => {
    setMounts(prev => ({
      ...prev,
      [selectedEnv]: prev[selectedEnv].filter(m => m.id !== id)
    }))
  }

  const toggleSecretVisibility = (id: string) => {
    setVisibleSecrets(prev => ({ ...prev, [id]: !prev[id] }))
  }

  // Filtered Logs list
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchQuery = log.message.toLowerCase().includes(logFilterQuery.toLowerCase()) ||
                         log.source.toLowerCase().includes(logFilterQuery.toLowerCase())
      const matchLevel = logFilterLevel === "ALL" || log.level === logFilterLevel
      return matchQuery && matchLevel
    })
  }, [logs, logFilterQuery, logFilterLevel])

  // Troubleshooting FAQ list
  const faqList = [
    {
      q: "1. How do I manage my app?",
      a: "Manage your app configurations through the tabs above: 'Overview' tracks general deployment states and trigger rebuilds, 'Domains & SSL' configures ingress records and TLS certificates, 'Environment & Networking' handles configuration variables, 'Storage & Mounts' mounts configuration files/secrets into container pods, 'Autoscaling' scales replicas dynamically, and 'Metrics' tracks load.",
      tab: "overview"
    },
    {
      q: "2. How do I change or custom domain? What DNS should I set?",
      a: "Go to the 'Domains & SSL' tab, enter your domain name, and save. To verify, create an A Record in your DNS dashboard pointing to our IP: 76.76.21.21, or add a CNAME record targeting: laravel-shop.projects-green.dev.",
      tab: "domains"
    },
    {
      q: "3. How do I add environment variables?",
      a: "Go to the 'Environment & Net' tab. Enter the variable Name and Value. Toggle the 'Secret Value' option to mask the variable on the interface and store it encrypted in secrets. Click 'Save Variable'. You can also import `.env` files in bulk using the 'Bulk Import' simulator.",
      tab: "env"
    },
    {
      q: "4. I want to mount a private key file, how?",
      a: "Under the 'Storage & Mounts' tab, create a new Volume Mount. Provide a target Container Path (e.g. /var/www/html/storage/app/key.pem), set the mode to read-only, choose 'Secret (PEM)' as the source type, and paste your PEM key block. The platform mounts it as a secure file into your container pods.",
      tab: "mounts"
    },
    {
      q: "5. I want to rebuild my repository, there is an update. How?",
      a: "On the 'Overview' tab, locate the repository details. Click the 'Trigger Rebuild & Deploy' button. The platform pulls the latest updates from your repository, runs build configurations, validates health checks, and initiates a rolling update.",
      tab: "overview"
    },
    {
      q: "6. I want to see status of my app, why cannot I access it?",
      a: "Check the 'Overview' tab -> 'Accessibility & Port Diagnostics'. If the status is degraded or inaccessible, select the simulator options. A common issue is a Port Mismatch (the app is listening on port 3000 but the load balancer is routing traffic to port 80). The diagnostics card lists remediation suggestions.",
      tab: "overview"
    },
    {
      q: "7. My app is slow, is resource enough to handle the traffic? Where can I see metrics?",
      a: "Go to the 'Telemetry & Metrics' tab to view live CPU, RAM, and HTTP network requests. If usage is close to 100%, consider customizing limits under 'Scaling & Tuning' or enable Horizontal Pod Autoscaling (HPA) to spin up extra replicas.",
      tab: "metrics"
    },
    {
      q: "8. My SSL expired, why is the site not showing that?",
      a: "Check the domain certificates list under 'Domains & SSL'. If a domain shows 'Expired', click 'Force SSL Renewal' to trigger a verification. Note that web browsers heavily cache old SSL data; try testing via incognito or curl -Iv https://yourdomain.com.",
      tab: "domains"
    },
    {
      q: "9. I'm behind Cloudflare, my SSL cannot activate. Why?",
      a: "When Cloudflare Proxy (Orange Cloud) is active, Let's Encrypt HTTP challenges cannot verify domain ownership. Temporarily switch Cloudflare to 'DNS Only' (Grey Cloud) to allow verification to complete, then re-enable the proxy after SSL is active.",
      tab: "domains"
    },
    {
      q: "10. I'm behind Cloudflare, and it is in a redirect loop. How do I fix it?",
      a: "If Cloudflare is set to 'Flexible' SSL, it connects to our origin server via HTTP. Since our server redirects all HTTP traffic to HTTPS, this creates an infinite loop. Solution: Navigate to Cloudflare -> SSL/TLS settings, and change the SSL encryption mode to 'Full' or 'Full (strict)'.",
      tab: "domains"
    },
    {
      q: "11. I'm behind a proxy, client IPs show local IP instead of real IP.",
      a: "Go to 'Environment & Net' -> 'Reverse Proxy Configuration'. Toggle 'Trust Reverse Proxy Forwarded Headers'. This configures nginx/app ingress to read client IPs from the X-Forwarded-For header instead of returning internal load balancer node IPs.",
      tab: "env"
    },
    {
      q: "12. I need to customize my app resource because of lack of RAM.",
      a: "Go to the 'Autoscaling & Tuning' tab. Locate 'Resource Sizing'. You can scale Memory limits and CPU limits directly by typing or sliding. Click 'Save configurations' to initiate a rolling update with the new constraints.",
      tab: "scaling"
    },
    {
      q: "13. I need to add replica on my server, or enable HPA or VPA limits.",
      a: "Go to 'Autoscaling & Tuning' tab -> scaling policies. You can manually adjust the replica counter, or toggle 'Horizontal Pod Autoscaler (HPA)' to set minimum/maximum replicas and target load metrics. Toggle VPA to let the cluster optimize limits automatically.",
      tab: "scaling"
    },
    {
      q: "14. I need to see logs of my app (Opensearch Integration).",
      a: "Navigate to the 'Opensearch Log Viewer' tab. You can search key terms, filter by logs level (INFO, WARN, ERROR), and toggle live-tail streams. This is powered directly by our backend cluster Opensearch indexing.",
      tab: "logs"
    }
  ]

  const filteredFaqs = faqList.filter(f =>
    f.q.toLowerCase().includes(troubleshooterSearch.toLowerCase()) ||
    f.a.toLowerCase().includes(troubleshooterSearch.toLowerCase())
  )

  const handleDeepLink = (tabName: string) => {
    setActiveTab(tabName)
    setIsTroubleshooterOpen(false)
  }

  // Status badges mapping
  const statusBadge = () => {
    switch (healthStatus) {
      case "healthy":
        return <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/10 px-2.5 py-0.5 text-xs font-semibold text-green-500 border border-green-500/20"><CheckCircle size={14} className="animate-pulse" /> Healthy</span>
      case "degraded":
        return <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-500/10 px-2.5 py-0.5 text-xs font-semibold text-yellow-500 border border-yellow-500/20"><Warning size={14} /> Degraded</span>
      case "inaccessible":
        return <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-semibold text-red-500 border border-red-500/20"><ShieldWarning size={14} /> Inaccessible</span>
      case "deploying":
        return <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold text-blue-500 border border-blue-500/20"><ArrowClockwise size={14} className="animate-spin" /> Deploying</span>
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Banner Control Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-white/[0.08] bg-black/40 backdrop-blur-xl p-5 shadow-2xl">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold tracking-tight text-white">laravel-shop</h2>
            {statusBadge()}
          </div>
          <p className="text-xs text-muted-foreground">
            Current Environment: <strong className="text-white capitalize">{selectedEnv}</strong> &bull; Region: us-east-1
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Environment Switcher */}
          <div className="inline-flex rounded-lg bg-black/50 p-1 border border-white/[0.06]">
            {K8S_ENVIRONMENTS.map((env) => (
              <button
                key={env.id}
                type="button"
                onClick={() => setSelectedEnv(env.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                  selectedEnv === env.id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-white"
                }`}
              >
                {env.label}
              </button>
            ))}
          </div>

          {/* FAQ & Troubleshooting Trigger */}
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsTroubleshooterOpen(true)}
            className="gap-2 text-xs border-primary/40 hover:border-primary/80 text-primary bg-primary/5"
          >
            <Question size={16} />
            Operations FAQ
          </Button>

          {/* Simulation Toggle Drawer */}
          <div className="flex items-center gap-1 border border-dashed border-white/[0.1] rounded-lg p-1 bg-black/20 text-xs">
            <span className="text-muted-foreground px-2">Simulate State:</span>
            <select
              value={diagnosticMode}
              onChange={(e) => setDiagnosticMode(e.target.value)}
              className="bg-black/50 text-white rounded px-2 py-1 text-xs border border-white/[0.1] focus:outline-none"
            >
              <option value="healthy">Healthy</option>
              <option value="error_502">502 Bad Gateway</option>
              <option value="ssl_expired">SSL Expired</option>
              <option value="redirect_loop">Redirect Loop</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div className="flex overflow-x-auto gap-1 border-b border-white/[0.08] pb-1 select-none scrollbar-none">
        {[
          { id: "overview", label: "Overview", icon: <Pulse size={16} /> },
          { id: "domains", label: "Domains & SSL", icon: <Globe size={16} /> },
          { id: "env", label: "Environment & Net", icon: <Lightning size={16} /> },
          { id: "mounts", label: "Storage & Mounts", icon: <Key size={16} /> },
          { id: "scaling", label: "Autoscaling & Tuning", icon: <Cpu size={16} /> },
          { id: "metrics", label: "Telemetry & Metrics", icon: <HardDrive size={16} /> },
          { id: "logs", label: "Opensearch Logs", icon: <TerminalIcon size={16} /> },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setActiveTab(item.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${
              activeTab === item.id
                ? "border-primary text-white bg-white/[0.02]"
                : "border-transparent text-muted-foreground hover:text-white"
            }`}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </div>

      {/* Tab Panels */}
      <div className="space-y-6">

        {/* OVERVIEW TAB */}
        {activeTab === "overview" && (
          <div className="grid gap-6 md:grid-cols-3">
            {/* Git Integration Details */}
            <Card className="col-span-2 border-white/[0.06] bg-black/25">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="space-y-1">
                  <CardTitle className="text-base font-bold text-white">Repository Deploy Status</CardTitle>
                  <CardDescription>Git repository synchronization and pipeline builds</CardDescription>
                </div>
                <span className="flex h-2.5 w-2.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                </span>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 rounded-lg bg-black/40 border border-white/[0.06] p-4 text-sm">
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground block">Source Provider</span>
                    <span className="font-semibold text-white flex items-center gap-1.5">
                      GitHub
                    </span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground block">Repository</span>
                    <span className="font-semibold text-white">acme/laravel-shop</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground block">Active Branch</span>
                    <span className="font-mono text-primary font-bold">main</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground block">Last Synced Commit</span>
                    <span className="font-mono font-semibold text-white">d4a7d0e (feat: optimize product...)</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Trigger build manually when updates are pushed:</span>
                    <Button
                      type="button"
                      onClick={handleRebuild}
                      disabled={rebuildState !== "idle"}
                      className="gap-2 text-xs"
                    >
                      <ArrowClockwise className={rebuildState !== "idle" ? "animate-spin" : ""} size={14} />
                      {rebuildState === "idle" ? "Rebuild & Deploy" : "Processing Build..."}
                    </Button>
                  </div>

                  {rebuildState !== "idle" && (
                    <div className="rounded-lg bg-black/90 p-4 font-mono text-xs text-green-400 max-h-[160px] overflow-y-auto border border-green-500/20">
                      {buildLogs.map((log, idx) => (
                        <div key={idx}>{log}</div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Inaccessible / Health Port Diagnostics (Q6 Answer) */}
            <Card className="border-white/[0.06] bg-black/25">
              <CardHeader>
                <CardTitle className="text-base font-bold text-white">Accessibility Diagnostics</CardTitle>
                <CardDescription>App endpoint availability auditing</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className={`rounded-lg border p-4 text-xs space-y-3 ${
                  diagnosticMode === "healthy"
                    ? "border-green-500/20 bg-green-500/5 text-green-300"
                    : "border-red-500/20 bg-red-500/5 text-red-300"
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="font-bold uppercase tracking-wider">Health Status Check</span>
                    <span className="font-mono text-white text-[10px] bg-black/50 px-2 py-0.5 rounded border border-white/[0.06]">
                      {diagnosticMode === "healthy" ? "HTTP 200 OK" : diagnosticMode === "error_502" ? "HTTP 502 Bad Gateway" : diagnosticMode === "ssl_expired" ? "SSL Certificate Expired" : "HTTP 301 Redirection Loop"}
                    </span>
                  </div>

                  {diagnosticMode === "healthy" && (
                    <p className="leading-relaxed">
                      Your app endpoints are responding normally. Cluster routing, SSL verification, and target pods are fully resolved.
                    </p>
                  )}

                  {diagnosticMode === "error_502" && (
                    <div className="space-y-2 leading-relaxed">
                      <p className="font-semibold text-red-400">
                        Diagnostics failed: 502 Bad Gateway detected.
                      </p>
                      <p>
                        <strong>Root Cause:</strong> The origin server inside the Kubernetes pod is not listening on the expected port (targetPort: 8080) or crashed on boot.
                      </p>
                      <p className="text-white bg-black/30 p-2 rounded border border-white/5 font-mono text-[10px]">
                        Solution: Go to your Dockerfile/code configuration and ensure the app starts up on port 8080. Check 'Opensearch Logs' to verify PHP-FPM / Node boot errors.
                      </p>
                    </div>
                  )}

                  {diagnosticMode === "ssl_expired" && (
                    <div className="space-y-2 leading-relaxed">
                      <p className="font-semibold text-red-400">
                        SSL Connection Handshake Failure
                      </p>
                      <p>
                        <strong>Root Cause:</strong> The custom domain certificate expired on 2026-05-18. Kubernetes cert-manager failed validation because DNS is misconfigured.
                      </p>
                      <p className="text-white bg-black/30 p-2 rounded border border-white/5 font-mono text-[10px]">
                        Solution: Visit the 'Domains & SSL' tab, check that your DNS records target the cluster IP exactly, and click 'Force SSL Renewal'.
                      </p>
                    </div>
                  )}

                  {diagnosticMode === "redirect_loop" && (
                    <div className="space-y-2 leading-relaxed">
                      <p className="font-semibold text-yellow-400">
                        Redirect Loop Detected (301 Infinite Redirections)
                      </p>
                      <p>
                        <strong>Root Cause:</strong> Cloudflare Flexible SSL is active. Cloudflare hits our ingress controller on HTTP, which redirects to HTTPS, and sends it back to Cloudflare.
                      </p>
                      <p className="text-white bg-black/30 p-2 rounded border border-white/5 font-mono text-[10px]">
                        Solution: Change your Cloudflare SSL/TLS setting from 'Flexible' to 'Full' or 'Full (strict)' to encrypt traffic to the origin.
                      </p>
                    </div>
                  )}
                </div>

                <div className="rounded-lg bg-black/40 border border-white/[0.06] p-3 text-xs space-y-2">
                  <span className="font-medium text-white block">Cluster Endpoint Details</span>
                  <div className="flex items-center justify-between text-muted-foreground font-mono">
                    <span>Cluster Host:</span>
                    <span className="text-white">k8s-ingress-prod.local</span>
                  </div>
                  <div className="flex items-center justify-between text-muted-foreground font-mono">
                    <span>Target Port:</span>
                    <span className="text-white">80 / 8080 (TCP)</span>
                  </div>
                  <div className="flex items-center justify-between text-muted-foreground font-mono">
                    <span>Replicas:</span>
                    <span className="text-white">{replicas} active</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* DOMAINS & SSL TAB (Q2, Q8, Q9, Q10) */}
        {activeTab === "domains" && (
          <div className="grid gap-6 md:grid-cols-3">
            {/* Custom Domains list */}
            <Card className="col-span-2 border-white/[0.06] bg-black/25">
              <CardHeader>
                <CardTitle className="text-base font-bold text-white">Custom Domain Settings</CardTitle>
                <CardDescription>Bind domain endpoints to your ingress router and issue automated SSL certs</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Domain Input Form */}
                <form onSubmit={handleAddDomain} className="flex gap-2">
                  <div className="relative flex-1">
                    <Globe size={18} className="absolute left-3 top-3 text-muted-foreground" />
                    <Input
                      placeholder="e.g. shop.acme.com"
                      value={newDomain}
                      onChange={(e) => setNewDomain(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <select
                    value={newDomainTls}
                    onChange={(e) => setNewDomainTls(e.target.value as any)}
                    className="bg-black/50 text-white rounded-lg border border-white/[0.1] px-3 text-sm focus:outline-none"
                  >
                    <option value="active">Active SSL</option>
                    <option value="pending">Pending Verification</option>
                    <option value="expired">Expired SSL (Simulation)</option>
                  </select>
                  <Button type="submit">Add Domain</Button>
                </form>

                {/* Domain Table */}
                <div className="rounded-lg border border-white/[0.08] overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-white/[0.02] border-b border-white/[0.08] text-muted-foreground uppercase font-semibold">
                        <th className="p-3">Domain</th>
                        <th className="p-3">DNS Status</th>
                        <th className="p-3">TLS Certificate</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.06]">
                      {domains[selectedEnv].map((item) => (
                        <tr key={item.id} className="hover:bg-white/[0.01] transition-all">
                          <td className="p-3 font-medium text-white">
                            <div className="flex items-center gap-1.5">
                              {item.domain}
                              {item.isPrimary && (
                                <span className="bg-primary/20 text-primary border border-primary/30 text-[9px] px-1.5 py-0.2 rounded font-semibold uppercase">
                                  Primary
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-3">
                            {item.dnsStatus === "verified" ? (
                              <span className="inline-flex items-center gap-1 text-green-400"><CheckCircle size={12} /> Target verified</span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-yellow-400 animate-pulse"><Warning size={12} /> Pending propagation</span>
                            )}
                          </td>
                          <td className="p-3">
                            {item.tlsStatus === "active" && (
                              <span className="inline-flex items-center gap-1 text-green-400">
                                <ShieldCheck size={14} /> Active (expires {item.expiresAt})
                              </span>
                            )}
                            {item.tlsStatus === "expired" && (
                              <span className="inline-flex items-center gap-1 text-red-400 font-semibold">
                                <ShieldWarning size={14} /> EXPIRED ({item.expiresAt})
                              </span>
                            )}
                            {item.tlsStatus === "pending" && (
                              <span className="inline-flex items-center gap-1 text-yellow-400">
                                <ArrowClockwise size={14} className="animate-spin" /> Issuing certificate...
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-right space-x-1.5">
                            {item.tlsStatus === "expired" && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => handleForceSSL(item.id)}
                                className="h-7 px-2 text-[10px] border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/10"
                              >
                                Force Renew SSL
                              </Button>
                            )}
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteDomain(item.id)}
                              className="h-7 w-7 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            >
                              <Trash size={14} />
                            </Button>
                          </td>
                        </tr>
                      ))}

                      {domains[selectedEnv].length === 0 && (
                        <tr>
                          <td colSpan={4} className="p-6 text-center text-muted-foreground">
                            No custom domains mapped yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* DNS instructions card (Q2 Answer) */}
                <div className="rounded-xl border border-white/[0.06] bg-black/40 p-5 space-y-4 text-xs">
                  <div className="space-y-1">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <Wrench size={16} className="text-primary" /> DNS Configuration Requirements
                    </span>
                    <p className="text-muted-foreground">Configure these DNS records in your domain registrar panel to map traffic to this application.</p>
                  </div>

                  <div className="grid gap-3 font-mono text-[11px]">
                    <div className="grid grid-cols-4 bg-white/[0.02] border border-white/[0.08] p-2.5 rounded-lg items-center">
                      <span className="text-muted-foreground font-semibold">TYPE</span>
                      <span className="text-muted-foreground font-semibold">HOST</span>
                      <span className="text-muted-foreground font-semibold col-span-2">VALUE / TARGET</span>
                    </div>
                    <div className="grid grid-cols-4 border border-white/[0.06] p-2.5 rounded-lg items-center">
                      <span className="text-green-400 font-bold">A</span>
                      <span className="text-white">@</span>
                      <span className="text-white col-span-2 flex items-center justify-between">
                        76.76.21.21
                        <button
                          type="button"
                          onClick={() => navigator.clipboard.writeText("76.76.21.21")}
                          className="text-[10px] text-primary hover:underline font-sans cursor-pointer"
                        >
                          Copy
                        </button>
                      </span>
                    </div>
                    <div className="grid grid-cols-4 border border-white/[0.06] p-2.5 rounded-lg items-center">
                      <span className="text-green-400 font-bold">CNAME</span>
                      <span className="text-white">www</span>
                      <span className="text-white col-span-2 flex items-center justify-between">
                        laravel-shop.projects-green.dev
                        <button
                          type="button"
                          onClick={() => navigator.clipboard.writeText("laravel-shop.projects-green.dev")}
                          className="text-[10px] text-primary hover:underline font-sans cursor-pointer"
                        >
                          Copy
                        </button>
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Cloudflare Troubleshooting Guides (Q9, Q10 Answers) */}
            <Card className="border-white/[0.06] bg-black/25 space-y-4">
              <CardHeader>
                <CardTitle className="text-base font-bold text-white flex items-center gap-1.5">
                  <Globe size={18} className="text-orange-500" /> Cloudflare Advisory
                </CardTitle>
                <CardDescription>Avoid issues when routing custom domains behind Cloudflare proxying</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-xs leading-relaxed">
                {/* Cloudflare config options simulator */}
                <div className="rounded-lg bg-black/40 border border-white/[0.06] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-white font-medium">Cloudflare Proxy Status</span>
                    <button
                      type="button"
                      onClick={() => setCloudflareProxied(!cloudflareProxied)}
                      className={`px-2.5 py-1 text-[10px] font-bold rounded cursor-pointer transition-all ${
                        cloudflareProxied ? "bg-orange-500/20 text-orange-400 border border-orange-500/30" : "bg-white/10 text-muted-foreground border border-white/10"
                      }`}
                    >
                      {cloudflareProxied ? "Proxied (Orange Cloud)" : "DNS Only (Grey Cloud)"}
                    </button>
                  </div>

                  <div className="space-y-1">
                    <span className="text-muted-foreground block text-[10px]">Cloudflare SSL/TLS Encryption Mode:</span>
                    <div className="grid grid-cols-3 gap-1 bg-black/60 rounded border border-white/[0.06] p-0.5">
                      {["flexible", "full", "strict"].map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setCloudflareSslMode(m as any)}
                          className={`rounded py-1 text-[9px] font-bold capitalize transition-all ${
                            cloudflareSslMode === m ? "bg-primary text-white" : "text-muted-foreground hover:text-white"
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Question 9 Explanation */}
                <div className="space-y-1.5 border-l-2 border-orange-500/40 pl-3">
                  <h4 className="font-bold text-white text-[13px]">SSL Failures Behind Proxy</h4>
                  <p className="text-muted-foreground text-[11px]">
                    If Cloudflare proxy is active before we verify your custom domain, our system's Let's Encrypt automated HTTP challenge might fail. Cloudflare intercepts verification traffic.
                  </p>
                  <p className="font-semibold text-primary text-[11px]">
                    Recommendation: Temporarily switch Cloudflare to "DNS Only" (Grey Cloud) until SSL is issued. Once active, proxy can be re-enabled.
                  </p>
                </div>

                {/* Question 10 Explanation */}
                <div className="space-y-1.5 border-l-2 border-red-500/40 pl-3">
                  <h4 className="font-bold text-white text-[13px]">Redirect Loops (ERR_TOO_MANY_REDIRECTS)</h4>
                  <p className="text-muted-foreground text-[11px]">
                    Using "Flexible" SSL forces Cloudflare to access our cluster over HTTP (port 80). Since our router mandates HTTPS redirection, it redirects Cloudflare back to HTTPS, causing an infinite loop.
                  </p>
                  <p className={`font-semibold text-[11px] ${cloudflareSslMode === "flexible" ? "text-yellow-400 underline" : "text-green-400"}`}>
                    {cloudflareSslMode === "flexible"
                      ? "⚠️ Current Config: Flexible mode will trigger a loop. Change Cloudflare SSL setting to 'Full' or 'Full (strict)'."
                      : "✓ Safe Config: SSL mode set to Full/Strict prevents redirection loops."}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ENVIRONMENT VARIABLES TAB (Q3, Q11) */}
        {activeTab === "env" && (
          <div className="grid gap-6 md:grid-cols-3">
            {/* Env List & CRUD */}
            <Card className="col-span-2 border-white/[0.06] bg-black/25">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="space-y-1">
                  <CardTitle className="text-base font-bold text-white">Environment Variables</CardTitle>
                  <CardDescription>Manage environment parameters injected into container pods at runtime</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsBulkOpen(true)}
                    className="h-8 text-xs border-white/[0.08]"
                  >
                    Bulk Import .env
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Env Var Form */}
                <form onSubmit={handleAddEnv} className="flex flex-wrap gap-2 items-center rounded-lg border border-white/[0.06] bg-black/30 p-3">
                  <Input
                    placeholder="KEY (e.g. CACHE_DRIVER)"
                    value={newEnvKey}
                    onChange={(e) => setNewEnvKey(e.target.value)}
                    className="flex-1 min-w-[150px] uppercase h-9 text-xs"
                  />
                  <Input
                    placeholder="Value"
                    value={newEnvVal}
                    onChange={(e) => setNewEnvVal(e.target.value)}
                    className="flex-2 min-w-[200px] h-9 text-xs"
                  />
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground select-none cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newEnvSecret}
                      onChange={(e) => setNewEnvSecret(e.target.checked)}
                      className="rounded border-white/20 bg-black/50 accent-primary"
                    />
                    Secret Value
                  </label>
                  <Button type="submit" size="sm" className="h-9 gap-1.5">
                    <Plus size={14} /> Add Var
                  </Button>
                </form>

                {/* Env List */}
                <div className="rounded-lg border border-white/[0.08] overflow-hidden text-xs">
                  <div className="grid grid-cols-4 bg-white/[0.02] border-b border-white/[0.08] p-3 text-muted-foreground uppercase font-semibold">
                    <span className="col-span-2">Name / Key</span>
                    <span>Value</span>
                    <span className="text-right">Actions</span>
                  </div>

                  <div className="divide-y divide-white/[0.06] max-h-[350px] overflow-y-auto">
                    {envVars[selectedEnv].map((item) => (
                      <div key={item.id} className="grid grid-cols-4 p-3 items-center hover:bg-white/[0.01]">
                        <span className="col-span-2 font-mono font-bold text-white break-all pr-2">
                          {item.key}
                          {item.isSecret && (
                            <span className="ml-1.5 bg-red-500/10 border border-red-500/20 text-red-400 text-[8px] px-1.5 py-0.2 rounded font-mono font-normal">
                              SECRET
                            </span>
                          )}
                        </span>
                        <span className="font-mono text-muted-foreground break-all">
                          {item.isSecret && !visibleSecrets[item.id] ? (
                            <span>••••••••••••••••</span>
                          ) : (
                            <span className="text-white">{item.value}</span>
                          )}
                        </span>
                        <span className="text-right space-x-1">
                          {item.isSecret && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleSecretVisibility(item.id)}
                              className="h-7 w-7 p-0 hover:bg-white/[0.06] text-muted-foreground hover:text-white"
                            >
                              {visibleSecrets[item.id] ? <EyeSlash size={14} /> : <Eye size={14} />}
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteEnv(item.id)}
                            className="h-7 w-7 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          >
                            <Trash size={14} />
                          </Button>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Reverse Proxy / Trust Proxy Configuration (Q11 Answer) */}
            <Card className="border-white/[0.06] bg-black/25">
              <CardHeader>
                <CardTitle className="text-base font-bold text-white flex items-center gap-1.5">
                  <ArrowsLeftRight size={18} className="text-primary" /> Reverse Proxy Ingress
                </CardTitle>
                <CardDescription>Trust proxy headers to capture authentic client metadata</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-xs leading-relaxed">
                <div className="rounded-lg bg-black/40 border border-white/[0.06] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-white font-medium">Trust Forwarded Headers</span>
                    <button
                      type="button"
                      onClick={() => setTrustProxy(!trustProxy)}
                      className={`px-3 py-1.5 text-xs font-bold rounded cursor-pointer transition-all ${
                        trustProxy ? "bg-primary text-white" : "bg-white/10 text-muted-foreground border border-white/10"
                      }`}
                    >
                      {trustProxy ? "TRUST ACTIVE" : "DISABLED"}
                    </button>
                  </div>
                  <p className="text-muted-foreground text-[11px]">
                    Configures nginx and application environment variable: <code>TRUST_PROXIES=*</code>.
                  </p>
                </div>

                <div className="space-y-2 pl-3 border-l-2 border-blue-500/40">
                  <h4 className="font-bold text-white text-[13px]">User IP Resolution (Q11)</h4>
                  <p className="text-muted-foreground text-[11px]">
                    When deployed behind proxy loads (like Cloudflare, ALB, or local nginx Ingress), client requests show internal local cluster IPs (e.g. <code>10.0.12.33</code>) in application logging.
                  </p>
                  <p className="text-muted-foreground text-[11px]">
                    <strong>Solution:</strong> Enabling "Trust Forwarded Headers" commands the application server to read client parameters from the <code>X-Forwarded-For</code> header sent by proxies.
                  </p>
                  {trustProxy ? (
                    <span className="inline-flex items-center gap-1 text-green-400 font-semibold text-[11px]">
                      ✓ Trust proxies is active. Real client IPs will show in application code (request()-&gt;ip()).
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-yellow-400 font-semibold text-[11px]">
                      ⚠️ Currently disabled. Client IP will register as internal cluster IP.
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* BULK IMPORT .ENV MODAL */}
        {isBulkOpen && (
          <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
            <div className="bg-neutral-900 border border-white/10 rounded-xl max-w-lg w-full p-5 space-y-4">
              <h3 className="text-base font-bold text-white">Bulk Import .env Variables</h3>
              <p className="text-xs text-muted-foreground">Paste plain text .env definitions (KEY=VALUE). Lines starting with # will be skipped.</p>
              <textarea
                value={bulkEnvText}
                onChange={(e) => setBulkEnvText(e.target.value)}
                placeholder="APP_KEY=base64:...\nDB_DATABASE=shop\nCACHE_DRIVER=redis"
                rows={8}
                className="w-full bg-black/50 text-white border border-white/[0.1] rounded-lg p-3 font-mono text-xs focus:outline-none"
              />
              <div className="flex justify-end gap-2 text-xs">
                <Button type="button" variant="outline" onClick={() => setIsBulkOpen(false)}>Cancel</Button>
                <Button type="button" onClick={handleBulkEnvImport}>Import Variables</Button>
              </div>
            </div>
          </div>
        )}

        {/* STORAGE & MOUNTS TAB (Q4) */}
        {activeTab === "mounts" && (
          <div className="grid gap-6 md:grid-cols-3">
            {/* Create Mount form */}
            <Card className="border-white/[0.06] bg-black/25 col-span-1">
              <CardHeader>
                <CardTitle className="text-base font-bold text-white flex items-center gap-1.5">
                  <Key size={18} className="text-primary" /> Mount Private Key / Files
                </CardTitle>
                <CardDescription>Mount certificates or secrets securely as localized file paths</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-xs">
                {mountError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg font-medium text-[11px]">
                    {mountError}
                  </div>
                )}
                <form onSubmit={handleAddMount} className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-muted-foreground font-medium block">Mount Name</label>
                    <Input
                      placeholder="e.g. application-private-key"
                      value={newMountName}
                      onChange={(e) => setNewMountName(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-muted-foreground font-medium block">Container Target Path</label>
                    <Input
                      placeholder="e.g. /var/www/html/storage/app/key.pem"
                      value={newMountPath}
                      onChange={(e) => setNewMountPath(e.target.value)}
                      className="h-8 text-xs font-mono"
                    />
                    <span className="text-[10px] text-muted-foreground block leading-tight">
                      Must be absolute. Path is write-protected for security.
                    </span>
                  </div>
                  <div className="space-y-1">
                    <label className="text-muted-foreground font-medium block">PEM Content / Private Key Data</label>
                    <textarea
                      placeholder="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0..."
                      value={newMountContent}
                      onChange={(e) => setNewMountContent(e.target.value)}
                      rows={6}
                      className="w-full bg-black/50 text-white border border-white/[0.1] rounded-lg p-2.5 font-mono text-[10px] focus:outline-none"
                    />
                  </div>

                  <label className="flex items-center gap-1.5 text-muted-foreground select-none cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newMountReadOnly}
                      onChange={(e) => setNewMountReadOnly(e.target.checked)}
                      className="rounded border-white/20 bg-black/50 accent-primary"
                    />
                    Read-Only (Recommended: Mode 0400)
                  </label>

                  <Button type="submit" className="w-full h-8 text-xs mt-2">Create File Mount</Button>
                </form>
              </CardContent>
            </Card>

            {/* Active Mounts List */}
            <Card className="col-span-2 border-white/[0.06] bg-black/25">
              <CardHeader>
                <CardTitle className="text-base font-bold text-white">Active Pod File Mounts</CardTitle>
                <CardDescription>File injections mapped directly into target containers</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border border-white/[0.08] overflow-hidden text-xs">
                  <div className="grid grid-cols-4 bg-white/[0.02] border-b border-white/[0.08] p-3 text-muted-foreground uppercase font-semibold">
                    <span>Mount Target</span>
                    <span>Type / Mode</span>
                    <span>Content Summary</span>
                    <th className="text-right font-normal">Actions</th>
                  </div>

                  <div className="divide-y divide-white/[0.06]">
                    {mounts[selectedEnv].map((item) => (
                      <div key={item.id} className="grid grid-cols-4 p-3 items-center hover:bg-white/[0.01]">
                        <span className="font-mono font-bold text-white break-all pr-2">{item.mountPath}</span>
                        <span className="text-muted-foreground font-mono">
                          {item.sourceType.toUpperCase()} ({item.fileMode})
                          {item.readOnly && <span className="block text-[9px] text-green-400">Read-Only</span>}
                        </span>
                        <span className="font-mono text-muted-foreground text-[10px] break-all max-w-[200px] whitespace-pre block bg-black/30 p-1.5 border border-white/5 rounded">
                          {item.contentSummary}
                        </span>
                        <span className="text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteMount(item.id)}
                            className="h-7 w-7 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          >
                            <Trash size={14} />
                          </Button>
                        </span>
                      </div>
                    ))}

                    {mounts[selectedEnv].length === 0 && (
                      <div className="p-6 text-center text-muted-foreground">
                        No private key or volume files mounted.
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-white/[0.06] bg-black/40 p-4 text-xs space-y-2 leading-relaxed">
                  <span className="font-bold text-white block">In-Container Mounting Mechanics</span>
                  <p className="text-muted-foreground">
                    Private keys are stored in encrypted Kubernetes <code>Secrets</code>, then mapped at boot via a volume definition:
                  </p>
                  <pre className="p-2.5 bg-black/80 rounded border border-white/[0.06] text-[10px] font-mono text-green-400 overflow-x-auto">
{`volumes:
  - name: secure-key-volume
    secret:
      secretName: dev-secrets-pem
      items: [{ key: "pem", path: "key.pem", mode: 256 }]`}
                  </pre>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* AUTOSCALING & TUNING TAB (Q12, Q13) */}
        {activeTab === "scaling" && (
          <div className="grid gap-6 md:grid-cols-3">
            {/* Resource Limits (Q12 Answer) */}
            <Card className="border-white/[0.06] bg-black/25 col-span-1">
              <CardHeader>
                <CardTitle className="text-base font-bold text-white flex items-center gap-1.5">
                  <Cpu size={18} className="text-primary" /> Resource Tuning
                </CardTitle>
                <CardDescription>Allocate CPU and RAM quotas to your container pods</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-xs">
                <div className="space-y-3 rounded-lg bg-black/40 border border-white/[0.06] p-4">
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-white font-medium">Memory Request (Min)</span>
                      <span className="font-mono text-primary font-bold">{memRequest}</span>
                    </div>
                    <select
                      value={memRequest}
                      onChange={(e) => setMemRequest(e.target.value)}
                      className="w-full bg-black/50 text-white rounded border border-white/[0.1] px-2 py-1.5 text-xs focus:outline-none"
                    >
                      <option value="128Mi">128 MiB (Standard)</option>
                      <option value="256Mi">256 MiB</option>
                      <option value="512Mi">512 MiB</option>
                      <option value="1024Mi">1024 MiB (1 GiB)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-white font-medium">Memory Limit (Max) (Q12)</span>
                      <span className="font-mono text-primary font-bold">{memLimit}</span>
                    </div>
                    <select
                      value={memLimit}
                      onChange={(e) => setMemLimit(e.target.value)}
                      className="w-full bg-black/50 text-white rounded border border-white/[0.1] px-2 py-1.5 text-xs focus:outline-none"
                    >
                      <option value="256Mi">256 MiB</option>
                      <option value="512Mi">512 MiB (Standard)</option>
                      <option value="1024Mi">1024 MiB (1 GiB)</option>
                      <option value="2048Mi">2048 MiB (2 GiB) - Higher Traffic</option>
                      <option value="4096Mi">4096 MiB (4 GiB)</option>
                    </select>
                    <span className="text-[10px] text-muted-foreground block leading-tight">
                      Adjust Memory Limit to avoid Out-Of-Memory (OOM) status.
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-white font-medium">CPU Limit (Max)</span>
                      <span className="font-mono text-primary font-bold">{cpuLimit}</span>
                    </div>
                    <select
                      value={cpuLimit}
                      onChange={(e) => setCpuLimit(e.target.value)}
                      className="w-full bg-black/50 text-white rounded border border-white/[0.1] px-2 py-1.5 text-xs focus:outline-none"
                    >
                      <option value="500m">0.5 Cores (500m)</option>
                      <option value="1000m">1.0 Cores (1000m)</option>
                      <option value="2000m">2.0 Cores (2000m)</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-white font-medium">Manual Replicas</span>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setReplicas(Math.max(1, replicas - 1))}
                        disabled={hpaEnabled}
                        className="h-6 w-6 p-0 text-white border-white/10"
                      >
                        -
                      </Button>
                      <span className="font-mono font-bold text-white w-6 text-center">{replicas}</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setReplicas(replicas + 1)}
                        disabled={hpaEnabled}
                        className="h-6 w-6 p-0 text-white border-white/10"
                      >
                        +
                      </Button>
                    </div>
                  </div>
                  {hpaEnabled && (
                    <span className="text-[9px] text-yellow-400 block leading-tight">
                      ⚠️ Manual replicas are locked because HPA is active.
                    </span>
                  )}
                </div>

                <Button type="button" className="w-full" onClick={() => alert("Configurations updated! Initiating rolling restart...")}>
                  Save Resource Settings
                </Button>
              </CardContent>
            </Card>

            {/* Autoscaling Policies (Q13 Answer) */}
            <Card className="col-span-2 border-white/[0.06] bg-black/25">
              <CardHeader>
                <CardTitle className="text-base font-bold text-white">Autoscaling Policies (HPA / VPA)</CardTitle>
                <CardDescription>Automate horizontal scale-out and vertical limits optimizations</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* HPA Card section */}
                <div className="rounded-xl border border-white/[0.06] bg-black/40 p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                    <div className="space-y-0.5">
                      <span className="font-bold text-white text-sm block">Horizontal Pod Autoscaler (HPA)</span>
                      <span className="text-xs text-muted-foreground block">Dynamically scale replicas based on CPU/RAM thresholds</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setHpaEnabled(!hpaEnabled)}
                      className={`px-3 py-1 text-xs font-bold rounded cursor-pointer transition-all ${
                        hpaEnabled ? "bg-green-500/20 text-green-400 border border-green-500/30" : "bg-white/10 text-muted-foreground border border-white/10"
                      }`}
                    >
                      {hpaEnabled ? "Active" : "Disabled"}
                    </button>
                  </div>

                  {hpaEnabled && (
                    <div className="grid gap-4 sm:grid-cols-3 text-xs">
                      <div className="space-y-1.5">
                        <label className="text-muted-foreground block">Min Replicas</label>
                        <Input
                          type="number"
                          value={hpaMinReplicas}
                          onChange={(e) => setHpaMinReplicas(Number(e.target.value))}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-muted-foreground block">Max Replicas</label>
                        <Input
                          type="number"
                          value={hpaMaxReplicas}
                          onChange={(e) => setHpaMaxReplicas(Number(e.target.value))}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-muted-foreground block">CPU Target Utilization (%)</label>
                        <Input
                          type="number"
                          value={hpaCpuTarget}
                          onChange={(e) => setHpaCpuTarget(Number(e.target.value))}
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* VPA Card section */}
                <div className="rounded-xl border border-white/[0.06] bg-black/40 p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                    <div className="space-y-0.5">
                      <span className="font-bold text-white text-sm block">Vertical Pod Autoscaler (VPA)</span>
                      <span className="text-xs text-muted-foreground block">Let the Kubernetes engine tune memory and CPU parameters based on historic usage</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setVpaEnabled(!vpaEnabled)}
                      className={`px-3 py-1 text-xs font-bold rounded cursor-pointer transition-all ${
                        vpaEnabled ? "bg-green-500/20 text-green-400 border border-green-500/30" : "bg-white/10 text-muted-foreground border border-white/10"
                      }`}
                    >
                      {vpaEnabled ? "Active" : "Disabled"}
                    </button>
                  </div>

                  {vpaEnabled && (
                    <div className="space-y-2 text-xs">
                      <label className="text-muted-foreground block">VPA Update Mode</label>
                      <div className="flex gap-2">
                        {["Off", "Initial", "Auto"].map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => setVpaMode(mode as any)}
                            className={`rounded-lg px-3 py-1.5 text-xs font-medium border transition-all ${
                              vpaMode === mode
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-white/[0.08] text-muted-foreground hover:text-white"
                            }`}
                          >
                            {mode}
                          </button>
                        ))}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        <strong>Auto:</strong> Automatically updates pod sizes (forces pod recreate if needed). <strong className="text-white">Initial:</strong> Sets optimized requests at pod launch. <strong className="text-white">Off:</strong> Recommendations only.
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* METRICS TAB (Q7) */}
        {activeTab === "metrics" && (
          <div className="grid gap-6 md:grid-cols-3">
            {/* Real-time telemetry */}
            <Card className="col-span-2 border-white/[0.06] bg-black/25">
              <CardHeader>
                <CardTitle className="text-base font-bold text-white">Live Resource Monitoring</CardTitle>
                <CardDescription>Track CPU, RAM, and Network HTTP traffic in real-time</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* CPU usage bar */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-white font-medium flex items-center gap-1.5">
                      <Cpu size={14} className="text-primary" /> CPU Allocation
                    </span>
                    <span className="font-mono text-muted-foreground">340m / {cpuLimit} (34%)</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-neutral-900 border border-white/[0.08] p-0.5">
                    <div className="h-full rounded-full bg-primary transition-all duration-1000" style={{ width: "34%" }} />
                  </div>
                </div>

                {/* RAM usage bar */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-white font-medium flex items-center gap-1.5">
                      <HardDrive size={14} className="text-primary" /> RAM Allocation
                    </span>
                    <span className="font-mono text-muted-foreground">468MiB / {memLimit} (91%)</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-neutral-900 border border-white/[0.08] p-0.5">
                    <div className="h-full rounded-full bg-red-500 transition-all duration-1000" style={{ width: "91%" }} />
                  </div>
                </div>

                {/* Traffic usage bar */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-white font-medium flex items-center gap-1.5">
                      <Pulse size={14} className="text-primary" /> Network Ingress Requests
                    </span>
                    <span className="font-mono text-muted-foreground">242 requests/sec (Normal)</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-neutral-900 border border-white/[0.08] p-0.5">
                    <div className="h-full rounded-full bg-green-500 transition-all duration-1000" style={{ width: "65%" }} />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recommendations / warnings (Q7 Answer) */}
            <Card className="border-white/[0.06] bg-black/25">
              <CardHeader>
                <CardTitle className="text-base font-bold text-white flex items-center gap-1.5">
                  <Warning size={18} className="text-yellow-500" /> Resource Advisory
                </CardTitle>
                <CardDescription>Analytics recommendations based on historic metrics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-xs leading-relaxed">
                <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4 text-red-300 space-y-2">
                  <span className="font-bold uppercase tracking-wider block">⚠️ Low RAM Headroom</span>
                  <p>
                    Your app is utilizing <strong>91% of allocated RAM</strong> (468MiB of 512MiB). This triggers warning signals. Under load, pods will suffer OOMKilled restarts.
                  </p>
                  <p className="font-semibold text-white bg-black/40 p-2 rounded border border-white/5 font-mono text-[10px]">
                    Recommendation: Scale your Memory Limit to 1024MiB (1GiB) in the 'Autoscaling & Tuning' tab.
                  </p>
                </div>

                <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-4 text-green-300 space-y-2">
                  <span className="font-bold uppercase tracking-wider block">✓ CPU Headroom Adequate</span>
                  <p>
                    CPU usage is steady at 34% (340m cores). The allocated 1.0 core limit provides plenty of buffer for routing requests.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* LOGS TAB (Q14) */}
        {activeTab === "logs" && (
          <Card className="border-white/[0.06] bg-black/25">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="space-y-1">
                <CardTitle className="text-base font-bold text-white">Opensearch Log Viewer</CardTitle>
                <CardDescription>Live streaming log aggregates index from this workspace cluster</CardDescription>
              </div>
              <div className="flex gap-2">
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground select-none cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isLiveTailing}
                    onChange={(e) => setIsLiveTailing(e.target.checked)}
                    className="rounded border-white/20 bg-black/50 accent-primary"
                  />
                  Live Tail
                </label>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Search & Level Filter bar */}
              <div className="flex flex-wrap gap-2 items-center bg-black/40 border border-white/[0.06] p-3 rounded-lg text-xs">
                <div className="relative flex-1 min-w-[200px]">
                  <MagnifyingGlass size={16} className="absolute left-3 top-2.5 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search logs (e.g. nginx, connect, database)..."
                    value={logFilterQuery}
                    onChange={(e) => setLogFilterQuery(e.target.value)}
                    className="bg-black/50 text-white rounded-lg border border-white/[0.1] pl-9 pr-3 py-2 w-full text-xs focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="flex gap-1.5">
                  {(["ALL", "INFO", "WARN", "ERROR"] as const).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setLogFilterLevel(lvl)}
                      className={`rounded px-2.5 py-1.5 font-bold transition-all ${
                        logFilterLevel === lvl
                          ? "bg-primary text-white"
                          : "bg-black/40 text-muted-foreground hover:text-white border border-white/[0.08]"
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Logs display shell */}
              <div className="rounded-xl bg-black border border-white/[0.08] p-5 font-mono text-[11px] leading-relaxed max-h-[380px] min-h-[250px] overflow-y-auto space-y-1">
                {filteredLogs.map((log, idx) => (
                  <div key={idx} className="flex gap-2.5 select-text hover:bg-white/[0.02] p-0.5 rounded">
                    <span className="text-muted-foreground shrink-0">[{log.timestamp}]</span>
                    <span className={`shrink-0 font-bold ${
                      log.level === "ERROR" ? "text-red-500" : log.level === "WARN" ? "text-yellow-500" : "text-blue-400"
                    }`}>
                      {log.level}
                    </span>
                    <span className="text-purple-400 shrink-0">[{log.source}]</span>
                    <span className="text-white break-all">{log.message}</span>
                  </div>
                ))}

                {filteredLogs.length === 0 && (
                  <div className="p-8 text-center text-muted-foreground font-sans">
                    No log outputs correspond to the search queries.
                  </div>
                )}
                <div ref={logConsoleEndRef} />
              </div>
            </CardContent>
          </Card>
        )}

      </div>

      {/* OPERATIONS TROUBLESHOOTER drawer (Q1 - Q14 Answers) */}
      {isTroubleshooterOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex justify-end">
          <div className="bg-neutral-950 border-l border-white/10 w-full max-w-lg p-6 space-y-5 overflow-y-auto flex flex-col h-full shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Wrench size={18} className="text-primary" /> Application Operations FAQ
                </h3>
                <p className="text-xs text-muted-foreground">Self-serve answers to operations and troubleshooting</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsTroubleshooterOpen(false)}
                className="text-muted-foreground hover:text-white"
              >
                Close
              </Button>
            </div>

            {/* FAQ Search */}
            <div className="relative">
              <MagnifyingGlass size={16} className="absolute left-3 top-2.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search troubleshooting questions..."
                value={troubleshooterSearch}
                onChange={(e) => setTroubleshooterSearch(e.target.value)}
                className="bg-black/50 text-white rounded-lg border border-white/[0.1] pl-9 pr-3 py-2 w-full text-xs focus:outline-none"
              />
            </div>

            {/* Questions List */}
            <div className="flex-1 space-y-4 overflow-y-auto pr-1">
              {filteredFaqs.map((faq, idx) => (
                <div key={idx} className="rounded-lg border border-white/[0.06] bg-black/35 p-4 space-y-2">
                  <h4 className="font-bold text-white text-xs leading-snug">{faq.q}</h4>
                  <p className="text-muted-foreground text-[11px] leading-relaxed">{faq.a}</p>
                  <button
                    type="button"
                    onClick={() => handleDeepLink(faq.tab)}
                    className="inline-flex items-center gap-1.5 text-[10px] text-primary font-semibold hover:underline mt-1 cursor-pointer"
                  >
                    Go to Setting <ArrowRight size={10} />
                  </button>
                </div>
              ))}

              {filteredFaqs.length === 0 && (
                <div className="p-8 text-center text-muted-foreground text-xs">
                  No matches for search terms. Try keywords like "SSL", "Cloudflare", "metrics", "replica", or "private".
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
