import { describe, expect, it, mock } from "bun:test"

const mockCommitFiles = mock()

mock.module("./gitops.service", () => ({
  GitOpsRepositoryService: class {
    commitFiles = mockCommitFiles
  },
}))

import {
  type AppStack,
  type GitOpsRepoConfig,
  ManifestBuilder,
  type StackContainer,
  StackSyncService,
} from "./stack-sync.service"

describe("ManifestBuilder", () => {
  const sampleStack: AppStack = {
    id: "stack-123",
    name: "My App",
    slug: "my-app",
    namespace: "prod-my-app",
    teamSlug: "core-team",
    version: "v1.2.0",
    containers: [],
  }

  const baseContainer: StackContainer = {
    name: "web",
    type: "deployment",
    image: "nginx",
    tag: "1.25",
    replicas: 3,
  }

  it("builds Namespace manifest with correct metadata and labels", () => {
    const builder = new ManifestBuilder(sampleStack)
    const ns = builder.buildNamespace()

    expect(ns).toEqual({
      apiVersion: "v1",
      kind: "Namespace",
      metadata: {
        name: "prod-my-app",
        labels: {
          "app.kubernetes.io/name": "my-app",
          "app.kubernetes.io/managed-by": "projects-green",
          team: "core-team",
        },
      },
    })
  })

  it("builds Deployment manifest with default settings and fallback values", () => {
    const builder = new ManifestBuilder({
      ...sampleStack,
      version: undefined,
    })
    const container: StackContainer = {
      name: "worker",
      type: "deployment",
      image: "worker-img",
    }
    const deployment = builder.buildContainerDeployment(container)

    expect(deployment.apiVersion).toBe("apps/v1")
    expect(deployment.kind).toBe("Deployment")
    expect(deployment.metadata).toEqual({
      name: "worker",
      namespace: "prod-my-app",
      labels: {
        "app.kubernetes.io/name": "worker",
        "app.kubernetes.io/instance": "my-app",
        "app.kubernetes.io/version": "latest",
        "app.kubernetes.io/part-of": "my-app",
        "app.kubernetes.io/managed-by": "projects-green",
        team: "core-team",
      },
      annotations: {},
    })

    const spec = deployment.spec as {
      replicas: number
      selector: unknown
      template: {
        metadata: unknown
        spec: {
          containers: Array<{
            name: string
            image: string
            ports: unknown[]
            resources: unknown
          }>
        }
      }
    }
    expect(spec.replicas).toBe(1)
    expect(spec.template.spec.containers[0].image).toBe("worker-img:latest")
    expect(spec.template.spec.containers[0].ports).toEqual([
      { name: "http", containerPort: 8080, protocol: "TCP" },
    ])
    expect(spec.template.spec.containers[0].resources).toEqual({
      requests: { cpu: "100m", memory: "128Mi" },
      limits: { cpu: "500m", memory: "512Mi" },
    })
  })

  it("builds StatefulSet with custom probes, env, resources, volumes, mounts, and reloader annotation", () => {
    const builder = new ManifestBuilder(sampleStack)
    const container: StackContainer = {
      name: "db",
      type: "statefulset",
      image: "postgres",
      tag: "16-alpine",
      replicas: 2,
      ports: [{ name: "postgres", containerPort: 5432, protocol: "TCP" }],
      cpuRequest: "250m",
      memoryRequestMb: 256,
      cpuLimit: "1000m",
      memoryLimitMb: 1024,
      startupProbeEnabled: true,
      startupProbePath: "/healthz",
      startupProbePort: 5432,
      readinessProbeEnabled: true,
      readinessProbePath: "/readyz",
      readinessProbePort: 5432,
      env: {
        POSTGRES_DB: "app",
        POSTGRES_USER: "admin",
      },
      configMaps: {
        "db-config": {
          value: { "init.sql": "SELECT 1;" },
          mountPath: "/docker-entrypoint-initdb.d",
          subPath: "init.sql",
          readOnly: true,
        },
      },
      secrets: {
        "db-secret": {
          value: { password: "secret" },
          mountPath: "/etc/secrets/db",
          subPath: "password",
          readOnly: true,
        },
      },
      tlsSecrets: {
        "db-tls": {
          cert: "cert-data",
          key: "key-data",
          mountPath: "/etc/tls/db",
        },
      },
      storages: [
        {
          name: "db-data",
          sizeGb: 10,
          mountPath: "/var/lib/postgresql/data",
          storageClass: "fast-ssd",
          accessMode: "ReadWriteOnce",
        },
      ],
    }

    const statefulSet = builder.buildContainerDeployment(container)
    expect(statefulSet.kind).toBe("StatefulSet")
    expect(
      (statefulSet.metadata as { annotations: Record<string, string> })
        .annotations
    ).toEqual({
      "reloader.stakater.com/auto": "true",
    })

    const spec = statefulSet.spec as {
      replicas: number
      template: {
        spec: {
          containers: Array<{
            name: string
            image: string
            env: Array<{ name: string; value: string }>
            resources: unknown
            volumeMounts: unknown[]
            startupProbe: unknown
            readinessProbe: unknown
          }>
          volumes: unknown[]
        }
      }
    }

    expect(spec.replicas).toBe(2)
    const c = spec.template.spec.containers[0]
    expect(c.image).toBe("postgres:16-alpine")
    expect(c.env).toEqual([
      { name: "POSTGRES_DB", value: "app" },
      { name: "POSTGRES_USER", value: "admin" },
    ])
    expect(c.resources).toEqual({
      requests: { cpu: "250m", memory: "256Mi" },
      limits: { cpu: "1000m", memory: "1024Mi" },
    })
    expect(c.startupProbe).toEqual({
      httpGet: { path: "/healthz", port: 5432 },
      initialDelaySeconds: 30,
      periodSeconds: 10,
    })
    expect(c.readinessProbe).toEqual({
      httpGet: { path: "/readyz", port: 5432 },
      initialDelaySeconds: 5,
      periodSeconds: 10,
    })

    expect(c.volumeMounts).toEqual([
      {
        name: "db-config",
        mountPath: "/docker-entrypoint-initdb.d",
        subPath: "init.sql",
        readOnly: true,
      },
      {
        name: "db-secret",
        mountPath: "/etc/secrets/db",
        subPath: "password",
        readOnly: true,
      },
      {
        name: "db-tls",
        mountPath: "/etc/tls/db",
        readOnly: true,
      },
      {
        name: "db-data",
        mountPath: "/var/lib/postgresql/data",
      },
    ])

    expect(spec.template.spec.volumes).toEqual([
      { name: "db-config", configMap: { name: "db-config" } },
      { name: "db-secret", secret: { secretName: "db-secret" } },
      { name: "db-tls", secret: { secretName: "db-tls" } },
      {
        name: "db-data",
        persistentVolumeClaim: { claimName: "db-data" },
      },
    ])
  })

  it("handles default paths for probes, configMaps, secrets, and tlsSecrets in deployment", () => {
    const builder = new ManifestBuilder(sampleStack)
    const container: StackContainer = {
      name: "api",
      type: "deployment",
      image: "api-image",
      ports: [{ containerPort: 3000 }],
      startupProbeEnabled: true,
      readinessProbeEnabled: true,
      configMaps: {
        "api-cm": { value: { key: "val" } },
      },
      secrets: {
        "api-sec": { value: { key: "sec" } },
      },
      tlsSecrets: {
        "api-tls": { cert: "c", key: "k" },
      },
    }

    const dep = builder.buildContainerDeployment(container)
    const c = (
      dep.spec as {
        template: {
          spec: {
            containers: Array<{
              startupProbe: { httpGet: { path: string; port: number } }
              readinessProbe: { httpGet: { path: string; port: number } }
              volumeMounts: Array<{
                name: string
                mountPath: string
                subPath?: string
                readOnly: boolean
              }>
            }>
          }
        }
      }
    ).template.spec.containers[0]

    expect(c.startupProbe.httpGet).toEqual({ path: "/health", port: 3000 })
    expect(c.readinessProbe.httpGet).toEqual({ path: "/ready", port: 3000 })
    expect(c.volumeMounts).toEqual([
      {
        name: "api-cm",
        mountPath: "/config/api-cm",
        subPath: undefined,
        readOnly: false,
      },
      {
        name: "api-sec",
        mountPath: "/secrets/api-sec",
        subPath: undefined,
        readOnly: true,
      },
      { name: "api-tls", mountPath: "/etc/tls/api-tls", readOnly: true },
    ])
  })

  it("builds Service manifest or returns null if no ports defined", () => {
    const builder = new ManifestBuilder(sampleStack)
    expect(
      builder.buildContainerService({ ...baseContainer, ports: [] })
    ).toBeNull()
    expect(
      builder.buildContainerService({ ...baseContainer, ports: undefined })
    ).toBeNull()

    const svc = builder.buildContainerService({
      ...baseContainer,
      ports: [
        { name: "http", containerPort: 80, protocol: "TCP" },
        { containerPort: 443 },
      ],
    })

    expect(svc).toEqual({
      apiVersion: "v1",
      kind: "Service",
      metadata: {
        name: "web",
        namespace: "prod-my-app",
        labels: {
          "app.kubernetes.io/name": "web",
          "app.kubernetes.io/instance": "my-app",
          "app.kubernetes.io/version": "v1.2.0",
          "app.kubernetes.io/part-of": "my-app",
          "app.kubernetes.io/managed-by": "projects-green",
          team: "core-team",
        },
      },
      spec: {
        type: "ClusterIP",
        selector: { "app.kubernetes.io/name": "web" },
        ports: [
          { name: "http", port: 80, targetPort: 80, protocol: "TCP" },
          { name: "http", port: 443, targetPort: 443, protocol: "TCP" },
        ],
      },
    })
  })

  it("builds ConfigMaps with reloader annotations", () => {
    const builder = new ManifestBuilder(sampleStack)
    expect(builder.buildConfigMaps(baseContainer)).toEqual([])

    const cms = builder.buildConfigMaps({
      ...baseContainer,
      configMaps: {
        "app-cfg": { value: { APP_ENV: "prod", PORT: "8080" } },
      },
    })

    expect(cms).toHaveLength(1)
    expect(cms[0]).toEqual({
      apiVersion: "v1",
      kind: "ConfigMap",
      metadata: {
        name: "app-cfg",
        namespace: "prod-my-app",
        labels: {
          "app.kubernetes.io/name": "web",
          "app.kubernetes.io/instance": "my-app",
          "app.kubernetes.io/version": "v1.2.0",
          "app.kubernetes.io/part-of": "my-app",
          "app.kubernetes.io/managed-by": "projects-green",
          team: "core-team",
        },
        annotations: { "reloader.stakater.com/auto": "true" },
      },
      data: { APP_ENV: "prod", PORT: "8080" },
    })
  })

  it("builds Opaque and TLS Secret manifests with base64 encoded data", () => {
    const builder = new ManifestBuilder(sampleStack)
    expect(builder.buildSecrets(baseContainer)).toEqual([])

    const secrets = builder.buildSecrets({
      ...baseContainer,
      secrets: {
        "app-secret": { value: { DB_PASS: "super-secret" } },
      },
      tlsSecrets: {
        "tls-cert": { cert: "CERT_CONTENT", key: "KEY_CONTENT" },
      },
    })

    expect(secrets).toHaveLength(2)
    expect(secrets[0]).toEqual({
      apiVersion: "v1",
      kind: "Secret",
      metadata: {
        name: "app-secret",
        namespace: "prod-my-app",
        labels: expect.any(Object),
        annotations: { "reloader.stakater.com/auto": "true" },
      },
      type: "Opaque",
      data: {
        DB_PASS: Buffer.from("super-secret").toString("base64"),
      },
    })

    expect(secrets[1]).toEqual({
      apiVersion: "v1",
      kind: "Secret",
      metadata: {
        name: "tls-cert",
        namespace: "prod-my-app",
        labels: expect.any(Object),
        annotations: { "reloader.stakater.com/auto": "true" },
      },
      type: "kubernetes.io/tls",
      data: {
        "tls.crt": Buffer.from("CERT_CONTENT").toString("base64"),
        "tls.key": Buffer.from("KEY_CONTENT").toString("base64"),
      },
    })
  })

  it("builds PVC manifests with default and custom StorageClass & accessModes", () => {
    const builder = new ManifestBuilder(sampleStack)
    expect(builder.buildPVCs(baseContainer)).toEqual([])

    const pvcs = builder.buildPVCs({
      ...baseContainer,
      storages: [
        {
          name: "storage-default",
          sizeGb: 5,
          mountPath: "/mnt/default",
        },
        {
          name: "storage-custom",
          sizeGb: 50,
          mountPath: "/mnt/custom",
          storageClass: "gp3",
          accessMode: "ReadWriteMany",
        },
      ],
    })

    expect(pvcs).toHaveLength(2)
    expect(pvcs[0]).toEqual({
      apiVersion: "v1",
      kind: "PersistentVolumeClaim",
      metadata: {
        name: "storage-default",
        namespace: "prod-my-app",
        labels: expect.any(Object),
      },
      spec: {
        accessModes: ["ReadWriteOnce"],
        storageClassName: "standard",
        resources: { requests: { storage: "5Gi" } },
      },
    })
    expect(pvcs[1]).toEqual({
      apiVersion: "v1",
      kind: "PersistentVolumeClaim",
      metadata: {
        name: "storage-custom",
        namespace: "prod-my-app",
        labels: expect.any(Object),
      },
      spec: {
        accessModes: ["ReadWriteMany"],
        storageClassName: "gp3",
        resources: { requests: { storage: "50Gi" } },
      },
    })
  })

  it("builds Ingress manifests with and without TLS and custom paths", () => {
    const builder = new ManifestBuilder(sampleStack)
    expect(builder.buildIngresses(baseContainer)).toEqual([])

    const ingresses = builder.buildIngresses({
      ...baseContainer,
      ports: [{ containerPort: 8080 }],
      ingresses: [
        {
          host: "example.com",
          tlsEnabled: false,
        },
        {
          host: "api.example.com",
          path: "/v1",
          serviceName: "custom-api-svc",
          servicePort: 9000,
          tlsEnabled: true,
          annotations: {
            "cert-manager.io/cluster-issuer": "letsencrypt-prod",
          },
        },
      ],
    })

    expect(ingresses).toHaveLength(2)
    expect(ingresses[0]).toEqual({
      apiVersion: "networking.k8s.io/v1",
      kind: "Ingress",
      metadata: {
        name: "web-ingress",
        namespace: "prod-my-app",
        labels: expect.any(Object),
        annotations: {
          "kubernetes.io/ingress.class": "nginx",
        },
      },
      spec: {
        rules: [
          {
            host: "example.com",
            http: {
              paths: [
                {
                  path: "/",
                  pathType: "Prefix",
                  backend: {
                    service: {
                      name: "web",
                      port: { number: 8080 },
                    },
                  },
                },
              ],
            },
          },
        ],
      },
    })

    expect(ingresses[1]).toEqual({
      apiVersion: "networking.k8s.io/v1",
      kind: "Ingress",
      metadata: {
        name: "web-ingress",
        namespace: "prod-my-app",
        labels: expect.any(Object),
        annotations: {
          "kubernetes.io/ingress.class": "nginx",
          "cert-manager.io/cluster-issuer": "letsencrypt-prod",
        },
      },
      spec: {
        rules: [
          {
            host: "api.example.com",
            http: {
              paths: [
                {
                  path: "/v1",
                  pathType: "Prefix",
                  backend: {
                    service: {
                      name: "custom-api-svc",
                      port: { number: 9000 },
                    },
                  },
                },
              ],
            },
          },
        ],
        tls: [
          {
            hosts: ["api.example.com"],
            secretName: "web-tls",
          },
        ],
      },
    })
  })

  it("builds HPA manifest with CPU, Memory, or fallback metrics", () => {
    const builder = new ManifestBuilder(sampleStack)

    // Non-deployment returns null
    expect(
      builder.buildHPA({
        ...baseContainer,
        type: "statefulset",
        autoScalingEnabled: true,
      })
    ).toBeNull()

    // autoScaling disabled returns null
    expect(
      builder.buildHPA({
        ...baseContainer,
        autoScalingEnabled: false,
      })
    ).toBeNull()

    // minReplicas == maxReplicas returns null
    expect(
      builder.buildHPA({
        ...baseContainer,
        autoScalingEnabled: true,
        minReplicas: 3,
        maxReplicas: 3,
      })
    ).toBeNull()

    // Fallback default CPU metric (80%)
    const defaultHpa = builder.buildHPA({
      ...baseContainer,
      autoScalingEnabled: true,
      minReplicas: 2,
      maxReplicas: 5,
    })
    expect(defaultHpa).toEqual({
      apiVersion: "autoscaling/v2",
      kind: "HorizontalPodAutoscaler",
      metadata: {
        name: "web-hpa",
        namespace: "prod-my-app",
        labels: expect.any(Object),
      },
      spec: {
        scaleTargetRef: {
          apiVersion: "apps/v1",
          kind: "Deployment",
          name: "web",
        },
        minReplicas: 2,
        maxReplicas: 5,
        metrics: [
          {
            type: "Resource",
            resource: {
              name: "cpu",
              target: { type: "Utilization", averageUtilization: 80 },
            },
          },
        ],
      },
    })

    // Custom CPU and Memory targets
    const customHpa = builder.buildHPA({
      ...baseContainer,
      autoScalingEnabled: true,
      minReplicas: 2,
      maxReplicas: 10,
      targetCpuPercentage: 70,
      targetMemoryPercentage: 85,
    })
    const spec = customHpa?.spec as {
      minReplicas: number
      maxReplicas: number
      metrics: unknown[]
    }
    expect(spec.minReplicas).toBe(2)
    expect(spec.maxReplicas).toBe(10)
    expect(spec.metrics).toEqual([
      {
        type: "Resource",
        resource: {
          name: "cpu",
          target: { type: "Utilization", averageUtilization: 70 },
        },
      },
      {
        type: "Resource",
        resource: {
          name: "memory",
          target: { type: "Utilization", averageUtilization: 85 },
        },
      },
    ])
  })

  it("builds ArgoCD Application manifest", () => {
    const builder = new ManifestBuilder(sampleStack)
    const app = builder.buildArgoCDApplication("my-org/gitops-repo")

    expect(app).toEqual({
      apiVersion: "argoproj.io/v1alpha1",
      kind: "Application",
      metadata: {
        name: "core-team-my-app",
        namespace: "argocd",
        finalizers: ["resources-finalizer.argocd.argoproj.io"],
      },
      spec: {
        project: "default",
        source: {
          repoURL: "https://github.com/my-org/gitops-repo",
          targetRevision: "HEAD",
          path: "services-yaml/core-team/my-app",
          directory: { recurse: true },
        },
        destination: {
          server: "https://kubernetes.default.svc",
          namespace: "prod-my-app",
        },
        syncPolicy: {
          automated: { prune: true, selfHeal: true, allowEmpty: false },
          syncOptions: [
            "CreateNamespace=true",
            "PrunePropagationPolicy=foreground",
            "PruneLast=true",
          ],
          retry: {
            limit: 5,
            backoff: { duration: "5s", factor: 2, maxDuration: "3m" },
          },
        },
        revisionHistoryLimit: 10,
      },
    })
  })
})

describe("StackSyncService", () => {
  const repoConfig: GitOpsRepoConfig = {
    owner: "test-org",
    repo: "gitops-manifests",
  }

  const stack: AppStack = {
    id: "stack-1",
    name: "Full App",
    slug: "full-app",
    namespace: "prod-full-app",
    teamSlug: "platform",
    version: "v2.0.0",
    containers: [
      {
        name: "web",
        type: "deployment",
        image: "web-app",
        tag: "v2.0.0",
        ports: [{ containerPort: 80 }],
        configMaps: {
          "web-cfg": { value: { KEY: "VAL" } },
          "web-cfg-2": { value: { KEY2: "VAL2" } },
        },
        secrets: {
          "web-sec": { value: { PASS: "123" } },
          "web-sec-2": { value: { PASS2: "456" } },
        },
        storages: [
          { name: "web-pvc-1", sizeGb: 1, mountPath: "/data1" },
          { name: "web-pvc-2", sizeGb: 2, mountPath: "/data2" },
        ],
        ingresses: [
          { host: "web.org", tlsEnabled: false },
          { host: "web2.org", tlsEnabled: true },
        ],
        autoScalingEnabled: true,
        minReplicas: 2,
        maxReplicas: 8,
      },
      {
        name: "db",
        type: "statefulset",
        image: "redis",
        ports: [],
      },
    ],
  }

  it("syncStack() commits all generated manifests to GitOps repository", async () => {
    mockCommitFiles.mockReset()
    mockCommitFiles.mockResolvedValueOnce({ sha: "commit-sha-12345" })

    const service = new StackSyncService("staging")
    const result = await service.syncStack(stack, repoConfig)

    expect(result).toEqual({
      success: true,
      commitSha: "commit-sha-12345",
      filesCount: 14,
      argocdAppCreated: true,
    })

    expect(mockCommitFiles).toHaveBeenCalledTimes(1)
    const [fullRepo, commitMsg, files, deletePaths] =
      mockCommitFiles.mock.calls[0]

    expect(fullRepo).toBe("test-org/gitops-manifests")
    expect(commitMsg).toBe("Deploy Full App to staging — v2.0.0")
    expect(deletePaths).toEqual([])

    const filePaths = files.map((f: { path: string }) => f.path)
    expect(filePaths).toContain("services-yaml/platform/namespace.yml")
    expect(filePaths).toContain(
      "services-yaml/platform/full-app/web/deployment.yml"
    )
    expect(filePaths).toContain(
      "services-yaml/platform/full-app/web/service.yml"
    )
    expect(filePaths).toContain(
      "services-yaml/platform/full-app/web/configmap.yml"
    )
    expect(filePaths).toContain(
      "services-yaml/platform/full-app/web/configmap-1.yml"
    )
    expect(filePaths).toContain(
      "services-yaml/platform/full-app/web/secret.yml"
    )
    expect(filePaths).toContain(
      "services-yaml/platform/full-app/web/secret-1.yml"
    )
    expect(filePaths).toContain("services-yaml/platform/full-app/web/pvc.yml")
    expect(filePaths).toContain("services-yaml/platform/full-app/web/pvc-1.yml")
    expect(filePaths).toContain(
      "services-yaml/platform/full-app/web/ingress.yml"
    )
    expect(filePaths).toContain(
      "services-yaml/platform/full-app/web/ingress-1.yml"
    )
    expect(filePaths).toContain("services-yaml/platform/full-app/web/hpa.yml")
    expect(filePaths).toContain(
      "services-yaml/platform/full-app/db/statefulset.yml"
    )
    expect(filePaths).toContain("argocd-projects/platform-full-app.yml")
  })

  it("deleteStack() removes stack manifests and ArgoCD project via commit", async () => {
    mockCommitFiles.mockReset()
    mockCommitFiles.mockResolvedValueOnce({ sha: "delete-sha-67890" })

    const service = new StackSyncService()
    await service.deleteStack(stack, repoConfig)

    expect(mockCommitFiles).toHaveBeenCalledTimes(1)
    const [fullRepo, commitMsg, files, deletePaths] =
      mockCommitFiles.mock.calls[0]

    expect(fullRepo).toBe("test-org/gitops-manifests")
    expect(commitMsg).toBe("Delete Full App")
    expect(files).toEqual([])
    expect(deletePaths).toEqual([
      "services-yaml/platform/full-app",
      "argocd-projects/platform-full-app.yml",
    ])
  })

  it("updateManifests() updates specific manifest types incrementally", async () => {
    mockCommitFiles.mockReset()
    mockCommitFiles.mockResolvedValueOnce({ sha: "update-sha" })

    const service = new StackSyncService()
    const container = stack.containers[0]

    await service.updateManifests(stack, repoConfig, [
      { type: "deployment", container },
      { type: "configmap", container },
      { type: "ingress", container },
      { type: "secret", container },
      { type: "pvc", container },
    ])

    expect(mockCommitFiles).toHaveBeenCalledTimes(1)
    const [, commitMsg, files] = mockCommitFiles.mock.calls[0]
    expect(commitMsg).toBe("Update Full App manifests")
    expect(files.length).toBe(9)
  })

  it("updateManifests() no-ops when no files match", async () => {
    mockCommitFiles.mockReset()

    const service = new StackSyncService()
    await service.updateManifests(stack, repoConfig, [])

    expect(mockCommitFiles).not.toHaveBeenCalled()
  })

  it("propagates error when gitops commitFiles fails", async () => {
    mockCommitFiles.mockReset()
    mockCommitFiles.mockRejectedValueOnce(
      new Error("Git commit failed: Network timeout")
    )

    const service = new StackSyncService()
    await expect(service.syncStack(stack, repoConfig)).rejects.toThrow(
      "Git commit failed: Network timeout"
    )
  })
})
