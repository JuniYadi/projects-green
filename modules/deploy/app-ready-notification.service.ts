import { Prisma } from "@prisma/client"
import { createWorkOS } from "@workos-inc/node"
import { prisma } from "@/lib/prisma"
import { getEmailBaseUrl } from "@/lib/email-url"
import { sendEmail } from "@/lib/queue/email"
import { VaultClient } from "@/lib/vault/vault-client"
import { buildVaultSecretPath } from "@/modules/secrets/vault-secrets.service"
import { formatTenantNamespace } from "./prometheus-telemetry.service"
import { resolveClusterIntegrationByClusterCode } from "./cluster-integration.service"
import { appTemplateBlueprintSchema } from "./blueprint/app-template-blueprint.schema"

const MAX_SAMPLE_AGE_SECONDS = 120

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char] ?? char
  )
}

// Query raw series: the dashboard telemetry DTO supplies synthetic pod data
// when samples are absent, so it must never gate a readiness notification.
export async function hasReadyPrometheusPod(
  input: {
    organizationId: string
    slug: string
    clusterCode: string
  },
  fetchFn: typeof fetch = fetch
): Promise<boolean> {
  const config = await resolveClusterIntegrationByClusterCode(
    input.clusterCode,
    "PROMETHEUS"
  )
  const namespace = formatTenantNamespace(input.organizationId)
  const slug = input.slug.replace(/[^a-zA-Z0-9_-]/g, "")
  const selector = `namespace="${namespace}",pod=~"${slug}.*"`
  const headers = {
    Authorization: `Basic ${Buffer.from(`${config.username}:${config.password}`).toString("base64")}`,
    Accept: "application/json",
  }
  const read = async (metric: string): Promise<Set<string>> => {
    const url = `${config.endpoint.replace(/\/+$/, "")}/api/v1/query?query=${encodeURIComponent(metric)}`
    const response = await fetchFn(url, {
      headers,
      signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) throw new Error("Prometheus unavailable")
    const body = (await response.json()) as {
      status?: string
      data?: {
        result?: Array<{ metric?: { pod?: string }; value?: [number, string] }>
      }
    }
    if (body.status !== "success" || !Array.isArray(body.data?.result)) {
      throw new Error("Invalid Prometheus response")
    }
    const now = Date.now() / 1000
    return new Set(
      body.data.result
        .filter(
          (item) =>
            item.metric?.pod?.startsWith(`${slug}-`) &&
            item.value?.[1] === "1" &&
            typeof item.value[0] === "number" &&
            now - item.value[0] >= 0 &&
            now - item.value[0] <= MAX_SAMPLE_AGE_SECONDS
        )
        .map((item) => item.metric!.pod!)
    )
  }
  const [ready, running] = await Promise.all([
    read(`kube_pod_status_ready{${selector},condition="true"}`),
    read(`kube_pod_status_phase{${selector},phase="Running"}`),
  ])
  return [...ready].some((pod) => running.has(pod))
}

export async function notifyReadyTemplateDeployment(
  deploymentId: string
): Promise<void> {
  const deployment = await prisma.applicationDeployment.findUnique({
    where: { id: deploymentId },
    include: { stack: { include: { template: true, cluster: true } } },
  })
  if (
    !deployment ||
    deployment.status !== "RUNNING" ||
    !deployment.ingressVerified
  )
    return
  const stack = deployment.stack
  if (
    stack.status !== "RUNNING" ||
    !stack.template ||
    !stack.cluster ||
    (!stack.subdomain && !stack.customDomain)
  )
    return
  const latest = await prisma.applicationDeployment.findFirst({
    where: { stackId: stack.id },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  })
  if (latest?.id !== deployment.id) return
  const blueprint = appTemplateBlueprintSchema.safeParse(
    stack.template.blueprintJson
  )
  const access = blueprint.data?.access
  if (!access) return
  const domain = stack.customDomain || stack.subdomain
  if (!domain) return

  if (
    !(await hasReadyPrometheusPod({
      organizationId: stack.organizationId,
      slug: stack.slug,
      clusterCode: stack.cluster.code,
    }))
  )
    return

  const refs = Array.isArray(stack.envVarsJson) ? stack.envVarsJson : []
  if (access.fields?.length) {
    const vaultPath = buildVaultSecretPath({
      organizationId: stack.organizationId,
      stackId: stack.id,
      environment: stack.slug.endsWith("-staging")
        ? "staging"
        : stack.slug.endsWith("-dev")
          ? "dev"
          : "prod",
    })
    if (
      !access.fields.every((field) =>
        refs.some(
          (ref) =>
            ref &&
            typeof ref === "object" &&
            !Array.isArray(ref) &&
            ref.type === "secret_ref" &&
            ref.key === field.key
        )
      )
    )
      return
    const values = await new VaultClient().readKV(vaultPath)
    if (
      !access.fields.every(
        (field) =>
          typeof values[field.key] === "string" && values[field.key].trim()
      )
    )
      return
  }

  const workos = createWorkOS({ apiKey: process.env.WORKOS_API_KEY ?? "" })
  const memberships = await workos.userManagement
    .listOrganizationMemberships({
      organizationId: stack.organizationId,
      statuses: ["active"],
    })
    .then((page) => page.autoPagination())
  const owner =
    memberships.find(
      (membership) => membership.role?.slug?.toLowerCase() === "user_owner"
    ) ??
    memberships.find(
      (membership) => membership.role?.slug?.toLowerCase() === "user_admin"
    )
  if (!owner?.userId) return
  const recipient = (await workos.userManagement.getUser(owner.userId)).email
  if (!recipient) return

  const subject = `${stack.template.name} siap digunakan`
  const workspaceUrl = `${getEmailBaseUrl()}/id/console/app/platform/${encodeURIComponent(stack.slug)}?tab=overview`
  const appUrl = `https://${domain}${access.loginPath ?? ""}`
  const docsUrl = `${getEmailBaseUrl()}/id/docs`
  const supportUrl = `${getEmailBaseUrl()}/id/console/support-tickets/new`
  const html =
    `<h1>${escapeHtml(access.title)}</h1><p>Aplikasi Anda siap digunakan.</p>` +
    `<ol>${access.steps.map((step) => `<li>${escapeHtml(step.text)}</li>`).join("")}</ol>` +
    `<p><a href="${escapeHtml(workspaceUrl)}">Masuk ke PFNApp untuk melihat panduan dan kredensial awal</a></p>` +
    `<p><a href="${escapeHtml(appUrl)}">Buka aplikasi</a></p>` +
    `<p><a href="${escapeHtml(docsUrl)}">Lihat dokumentasi</a> · ` +
    `<a href="${escapeHtml(supportUrl)}">Hubungi support</a></p>`

  // A deployment may be retried or reinstalled; the first ready email for a
  // stack wins. A database unique key protects concurrent monitor workers.
  const eventKey = `app-ready:${stack.id}`
  let log
  try {
    log = await prisma.emailLog.create({
      data: {
        eventKey,
        recipientEmail: recipient,
        type: "APP_HOSTING_READY",
        subject,
        bodyHtml: html,
        status: "QUEUED",
        organizationId: stack.organizationId,
        relatedEntityType: "ApplicationStack",
        relatedEntityId: stack.id,
      },
    })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      return
    throw error
  }
  try {
    await sendEmail({ to: recipient, subject, html, emailLogId: log.id })
  } catch (error) {
    await prisma.emailLog.deleteMany({
      where: { id: log.id, status: "QUEUED" },
    })
    throw error
  }
}
