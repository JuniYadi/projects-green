import type {
  K8sEnvironment,
  K8sEnvironmentId,
  CustomDomain,
  EnvVar,
  VolumeMount,
  LogMessage,
} from "@/modules/deploy/operate.types"

export const K8S_ENVIRONMENTS: K8sEnvironment[] = [
  {
    id: "dev",
    label: "Development",
    description: "Internal sandbox",
    color: "text-blue-500 bg-blue-500/10 border-blue-500/20",
  },
  {
    id: "staging",
    label: "Staging",
    description: "Pre-prod verification",
    color: "text-yellow-500 bg-yellow-500/10 border-yellow-500/20",
  },
  {
    id: "prod",
    label: "Production",
    description: "Live client traffic",
    color: "text-green-500 bg-green-500/10 border-green-500/20",
  },
]

export const INITIAL_DOMAINS: Record<K8sEnvironmentId, CustomDomain[]> = {
  dev: [
    {
      id: "dom-1",
      domain: "laravel-shop-dev.projects-green.dev",
      isPrimary: true,
      tlsStatus: "active",
      dnsStatus: "verified",
      expiresAt: "2026-08-20",
    },
  ],
  staging: [
    {
      id: "dom-2",
      domain: "staging.laravelshop.com",
      isPrimary: true,
      tlsStatus: "active",
      dnsStatus: "verified",
      expiresAt: "2026-08-15",
    },
  ],
  prod: [
    {
      id: "dom-3",
      domain: "laravelshop.com",
      isPrimary: true,
      tlsStatus: "active",
      dnsStatus: "verified",
      expiresAt: "2026-08-01",
    },
    {
      id: "dom-4",
      domain: "www.laravelshop.com",
      isPrimary: false,
      tlsStatus: "expired",
      dnsStatus: "verified",
      expiresAt: "2026-05-18",
    },
  ],
}

export const INITIAL_ENV_VARS: Record<K8sEnvironmentId, EnvVar[]> = {
  dev: [
    {
      id: "env-1",
      key: "APP_NAME",
      value: "LaravelShop Sandbox",
      isSecret: false,
      updatedAt: "2026-05-20",
    },
    {
      id: "env-2",
      key: "APP_ENV",
      value: "local",
      isSecret: false,
      updatedAt: "2026-05-20",
    },
    {
      id: "env-3",
      key: "APP_DEBUG",
      value: "true",
      isSecret: false,
      updatedAt: "2026-05-20",
    },
    {
      id: "env-4",
      key: "DB_CONNECTION",
      value: "mysql",
      isSecret: false,
      updatedAt: "2026-05-20",
    },
    {
      id: "env-5",
      key: "DB_PASSWORD",
      value: "<REDACTED_SECRET>",
      isSecret: true,
      updatedAt: "2026-05-20",
    },
  ],
  staging: [
    {
      id: "env-6",
      key: "APP_NAME",
      value: "LaravelShop Staging",
      isSecret: false,
      updatedAt: "2026-05-19",
    },
    {
      id: "env-7",
      key: "APP_ENV",
      value: "staging",
      isSecret: false,
      updatedAt: "2026-05-19",
    },
    {
      id: "env-8",
      key: "APP_DEBUG",
      value: "false",
      isSecret: false,
      updatedAt: "2026-05-19",
    },
    {
      id: "env-9",
      key: "TRUST_PROXIES",
      value: "*",
      isSecret: false,
      updatedAt: "2026-05-19",
    },
    {
      id: "env-10",
      key: "DB_PASSWORD",
      value: "<REDACTED_SECRET>",
      isSecret: true,
      updatedAt: "2026-05-19",
    },
  ],
  prod: [
    {
      id: "env-11",
      key: "APP_NAME",
      value: "LaravelShop Live",
      isSecret: false,
      updatedAt: "2026-05-15",
    },
    {
      id: "env-12",
      key: "APP_ENV",
      value: "production",
      isSecret: false,
      updatedAt: "2026-05-15",
    },
    {
      id: "env-13",
      key: "APP_DEBUG",
      value: "false",
      isSecret: false,
      updatedAt: "2026-05-15",
    },
    {
      id: "env-14",
      key: "DB_PASSWORD",
      value: "<REDACTED_SECRET>",
      isSecret: true,
      updatedAt: "2026-05-15",
    },
    {
      id: "env-15",
      key: "APP_KEY",
      value: "<REDACTED_SECRET>",
      isSecret: true,
      updatedAt: "2026-05-15",
    },
  ],
}

export const INITIAL_MOUNTS: Record<K8sEnvironmentId, VolumeMount[]> = {
  dev: [
    {
      id: "mnt-1",
      name: "dev-secrets-pem",
      mountPath: "/var/www/html/storage/app/key.pem",
      sourceType: "secret",
      fileMode: "0400",
      readOnly: true,
      contentSummary: "[REDACTED_PRIVATE_KEY] (640 bytes)",
    },
  ],
  staging: [
    {
      id: "mnt-2",
      name: "staging-cert-pem",
      mountPath: "/var/www/html/storage/app/cert.pem",
      sourceType: "secret",
      fileMode: "0400",
      readOnly: true,
      contentSummary: "[REDACTED_CERTIFICATE] (1200 bytes)",
    },
  ],
  prod: [
    {
      id: "mnt-3",
      name: "prod-api-private-key",
      mountPath: "/var/www/html/storage/app/private_key.pem",
      sourceType: "secret",
      fileMode: "0400",
      readOnly: true,
      contentSummary: "[REDACTED_PRIVATE_KEY] (1672 bytes)",
    },
  ],
}

export const INITIAL_LOGS: LogMessage[] = [
  {
    timestamp: "17:54:10",
    level: "INFO",
    source: "nginx",
    message: "Starting nginx/1.25.3 worker process",
  },
  {
    timestamp: "17:54:11",
    level: "INFO",
    source: "php-fpm",
    message: "fpm is running, ready to handle requests on port 9000",
  },
  {
    timestamp: "17:54:12",
    level: "INFO",
    source: "app",
    message:
      "Laravel service container booted successfully. Environment: production",
  },
  {
    timestamp: "17:54:15",
    level: "INFO",
    source: "database",
    message: "MySQL connection pool initialized. 12 active connections",
  },
  {
    timestamp: "17:54:30",
    level: "INFO",
    source: "nginx",
    message:
      '172.19.0.4 - "GET / HTTP/1.1" 200 4528 "-" "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"',
  },
  {
    timestamp: "17:54:32",
    level: "INFO",
    source: "app",
    message:
      "SQL query completed (1.2ms): SELECT * FROM settings WHERE name = 'theme' LIMIT 1",
  },
  {
    timestamp: "17:54:40",
    level: "WARN",
    source: "php-fpm",
    message:
      "Child process 42 exceeded execution timeout limit (60s). Terminated.",
  },
  {
    timestamp: "17:54:41",
    level: "INFO",
    source: "nginx",
    message:
      '172.19.0.4 - "GET /api/v1/products HTTP/1.1" 504 182 "-" "Mozilla/5.0"',
  },
  {
    timestamp: "17:54:45",
    level: "ERROR",
    source: "app",
    message:
      "Redis connection failed. Host 'redis-cache-prod' is unreachable. Retrying in 5s...",
  },
]
