import { promises as dns } from "node:dns"
import { prisma } from "@/lib/prisma"
import { resolveClusterIntegration } from "./cluster-integration.service"
import { fetchKubeJson } from "./pod-status.service"

type KubeIngress = {
  status?: {
    loadBalancer?: {
      ingress?: Array<{ ip?: string; hostname?: string }>
    }
  }
}

async function checkIngressAddress(
  stackId: string,
  slug: string
): Promise<boolean> {
  try {
    const kubeConfig = await resolveClusterIntegration(stackId, "KUBECONFIG")
    if (!kubeConfig.apiServerUrl || !kubeConfig.serviceAccountToken) {
      return false
    }

    const namespace = kubeConfig.namespacePattern.replace("{slug}", slug)
    const baseUrl = kubeConfig.apiServerUrl.replace(/\/$/, "")
    const ingressUrl = `${baseUrl}/apis/networking.k8s.io/v1/namespaces/${encodeURIComponent(
      namespace
    )}/ingresses/${encodeURIComponent(slug)}`

    const ingress = await fetchKubeJson<KubeIngress>(ingressUrl, kubeConfig)
    const entries = ingress?.status?.loadBalancer?.ingress ?? []
    return entries.some((entry) => Boolean(entry.ip || entry.hostname))
  } catch {
    return false
  }
}

async function checkDomainDns(customDomain: string | null): Promise<boolean> {
  if (!customDomain) return true
  try {
    const cname = await dns.resolveCname(customDomain)
    if (cname.length > 0) return true
  } catch {
    // CNAME lookup failed or doesn't exist — fall back to A/AAAA below
  }

  try {
    const [v4, v6] = await Promise.all([
      dns.resolve4(customDomain).catch(() => []),
      dns.resolve6(customDomain).catch(() => []),
    ])
    return v4.length > 0 || v6.length > 0
  } catch {
    return false
  }
}

export async function checkIngressReadiness(
  deploymentId: string
): Promise<boolean> {
  try {
    const deployment = await prisma.applicationDeployment.findUnique({
      where: { id: deploymentId },
      include: { stack: true },
    })
    if (!deployment) return false

    const [ingressOk, dnsOk] = await Promise.all([
      checkIngressAddress(deployment.stackId, deployment.stack.slug),
      checkDomainDns(deployment.stack.customDomain),
    ])

    return ingressOk && dnsOk
  } catch {
    return false
  }
}
