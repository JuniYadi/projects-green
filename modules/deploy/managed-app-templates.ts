export const MANAGED_APP_TEMPLATES = [
  {
    id: "n8n",
    name: "n8n",
    description: "Workflow automation",
    engineType: "MYSQL" as const,
    imageRepository: "docker.io/n8nio/n8n",
    defaultSubdomain: "n8n",
    cpuDefault: 500,
    memoryDefault: 512,
  },
  {
    id: "hermes",
    name: "Hermes",
    description: "AI Agent UI",
    engineType: "MYSQL" as const,
    imageRepository: "registry.pfnapp.com/hermes",
    defaultSubdomain: "hermes",
    cpuDefault: 500,
    memoryDefault: 512,
  },
  {
    id: "9router",
    name: "9router",
    description: "AI LLM Router",
    engineType: "POSTGRESQL" as const,
    imageRepository: "registry.pfnapp.com/ninerouter",
    defaultSubdomain: "router",
    cpuDefault: 250,
    memoryDefault: 256,
  },
  {
    id: "umami",
    name: "Umami",
    description: "Privacy Analytics",
    engineType: "POSTGRESQL" as const,
    imageRepository: "docker.io/umami-software/umami",
    defaultSubdomain: "analytics",
    cpuDefault: 250,
    memoryDefault: 256,
  },
] as const

export type ManagedAppTemplate = (typeof MANAGED_APP_TEMPLATES)[number]
