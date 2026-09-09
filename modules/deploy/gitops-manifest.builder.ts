import * as jsYaml from "js-yaml"

export interface GitOpsManifestPaths {
  appSlug: string
  namespace: string
  appServicesDir: string
  serviceDir: string
  argocdProjectPath: string
  helmPath: string
  valuePath: string
}

export function formatTenantFolder(
  orgId?: string | null,
  slug?: string | null
): string {
  if (!orgId) {
    return slug
      ? slug.startsWith("app-")
        ? slug
        : `app-${slug}`
      : "app-default"
  }
  const clean = orgId.replace(/^org_/, "app-").toLowerCase()
  return clean.startsWith("app-") ? clean : `app-${clean}`
}

export function resolveGitOpsManifestPaths(params: {
  slug: string
  organizationId?: string | null
  basePath: string
}): GitOpsManifestPaths {
  const { slug, organizationId, basePath } = params
  const tenantFolder = formatTenantFolder(organizationId, slug)
  const namespace = tenantFolder

  let appServicesDir: string
  if (basePath.includes("{slug}")) {
    appServicesDir = basePath.replace("{slug}", tenantFolder).replace(/\/$/, "")
  } else if (basePath.endsWith(`/${slug}`)) {
    appServicesDir = basePath
      .replace(new RegExp(`/${slug}$`), `/${tenantFolder}`)
      .replace(/\/$/, "")
  } else {
    const trimmed = basePath.replace(/\/$/, "")
    appServicesDir = trimmed
      ? `${trimmed}/${tenantFolder}`
      : `services-yaml/${tenantFolder}`
  }

  const serviceDir = `${appServicesDir}/${slug}`
  const argocdProjectPath = `argocd-projects/${tenantFolder}.yml`
  const helmPath = `${serviceDir}/helm.yml`
  const valuePath = `${serviceDir}/value.yml`

  return {
    appSlug: tenantFolder,
    namespace,
    appServicesDir,
    serviceDir,
    argocdProjectPath,
    helmPath,
    valuePath,
  }
}

export function buildArgoCdProjectManifest(params: {
  appSlug: string
  repoUrl: string
  branch: string
  servicesPath: string
  namespace: string
}): string {
  const manifest = {
    apiVersion: "argoproj.io/v1alpha1",
    kind: "Application",
    metadata: {
      name: params.appSlug,
      namespace: "argocd",
      finalizers: ["resources-finalizer.argocd.argoproj.io"],
      labels: {
        name: params.appSlug,
      },
    },
    spec: {
      project: "default",
      source: {
        repoURL: params.repoUrl,
        targetRevision: params.branch,
        path: params.servicesPath,
        directory: {
          recurse: true,
        },
      },
      destination: {
        server: "https://kubernetes.default.svc",
        namespace: params.namespace,
      },
      syncPolicy: {
        automated: {
          prune: true,
          selfHeal: true,
          allowEmpty: false,
        },
        syncOptions: ["CreateNamespace=true", "PruneLast=true"],
        retry: {
          limit: 5,
          backoff: {
            duration: "5s",
            factor: 2,
            maxDuration: "3m",
          },
        },
      },
      revisionHistoryLimit: 10,
      ignoreDifferences: [
        {
          group: "apps",
          kind: "Deployment",
          jsonPointers: ["/status/replicas", "/status/updatedReplicas"],
        },
        {
          group: "autoscaling",
          kind: "HorizontalPodAutoscaler",
          jsonPointers: ["/status/currentReplicas", "/status/desiredReplicas"],
        },
      ],
    },
  }

  return jsYaml.dump(manifest, {
    indent: 2,
    lineWidth: -1,
    noRefs: true,
  })
}

export function buildHelmApplicationManifest(params: {
  appName: string
  chartRepoUrl?: string
  chartName?: string
  chartVersion?: string
  gitopsRepoUrl: string
  branch: string
  valueFilePath: string
  namespace: string
}): string {
  const chartRepoUrl = params.chartRepoUrl ?? "https://pfnapp.github.io/charts"
  const chartName = params.chartName ?? "deploy"
  const chartVersion = params.chartVersion ?? "2.12.4"

  const manifest = {
    apiVersion: "argoproj.io/v1alpha1",
    kind: "Application",
    metadata: {
      name: params.appName,
      namespace: "argocd",
    },
    spec: {
      project: "default",
      sources: [
        {
          repoURL: chartRepoUrl,
          chart: chartName,
          targetRevision: chartVersion,
          helm: {
            valueFiles: [`$repoValue/${params.valueFilePath}`],
          },
        },
        {
          repoURL: params.gitopsRepoUrl,
          targetRevision: params.branch,
          ref: "repoValue",
        },
      ],
      destination: {
        server: "https://kubernetes.default.svc",
        namespace: params.namespace,
      },
      syncPolicy: {
        automated: {
          selfHeal: true,
          prune: true,
        },
        syncOptions: ["CreateNamespace=true"],
      },
    },
  }

  return jsYaml.dump(manifest, {
    indent: 2,
    lineWidth: -1,
    noRefs: true,
  })
}
