import { describe, it, expect } from "bun:test"
import { buildHelmValues, Helm } from "./helm-values.builder"

describe("buildHelmValues", () => {
  it("renders image and replicaCount with default resources", () => {
    const out = buildHelmValues({
      slug: "app-test",
      imageRepository: "registry.example.com/app-test",
      imageTag: "187",
      env: [],
    })
    expect(out.app).toEqual({ name: "app-test" })
    expect(out.image).toEqual({
      repository: "registry.example.com/app-test",
      tag: "187",
    })
    expect(out.replicaCount).toBe(1)
    expect(out.resources).toEqual({
      requests: { cpu: "500m", memory: "1024Mi" },
      limits: { cpu: "500m", memory: "1024Mi" },
    })
    expect(out.env).toBeUndefined()
    expect(out.externalSecret).toBeUndefined()
    expect(out.simpleIngress).toBeUndefined()
  })

  it("uses provided cpu/memory for both requests and limits", () => {
    const out = buildHelmValues({
      slug: "app-test",
      imageRepository: "r",
      imageTag: "1",
      env: [],
      cpu: 100,
      memory: 256,
    })
    expect(out.resources).toEqual({
      requests: { cpu: "100m", memory: "256Mi" },
      limits: { cpu: "100m", memory: "256Mi" },
    })
  })

  it("respects explicit replicas", () => {
    const out = buildHelmValues({
      slug: "s",
      imageRepository: "r",
      imageTag: "1",
      env: [],
      replicas: 3,
    })
    expect(out.replicaCount).toBe(3)
  })

  it("renders plain env entries as name/value pairs", () => {
    const out = buildHelmValues({
      slug: "s",
      imageRepository: "r",
      imageTag: "1",
      env: [
        { key: "NODE_ENV", value: "production" },
        { key: "PORT", value: "3000", type: "plain" },
      ],
    })
    expect(out.env).toEqual([
      { name: "NODE_ENV", value: "production" },
      { name: "PORT", value: "3000" },
    ])
  })

  it("emits externalSecret block when externalSecretVaultPath is provided", () => {
    const out = buildHelmValues({
      slug: "s",
      imageRepository: "r",
      imageTag: "1",
      env: [
        { key: "NODE_ENV", value: "production" },
        { key: "API_KEY", value: "shhh", type: "secret" },
      ],
      externalSecretVaultPath: "tenants/org/stacks/stack/prod/app-env",
    })

    expect(out.externalSecret).toEqual({
      enabled: true,
      secretStoreRef: { kind: "ClusterSecretStore", name: "vault-backend" },
      dataFrom: [{ extract: { key: "tenants/org/stacks/stack/prod/app-env" } }],
    })
    expect(out.secrets).toBeUndefined()
    expect(out.secret).toBeUndefined()
  })

  it("throws when secret env vars have no resolved Vault path", () => {
    expect(() =>
      buildHelmValues({
        slug: "s",
        imageRepository: "r",
        imageTag: "1",
        env: [{ key: "API_KEY", value: "shhh", type: "secret" }],
      })
    ).toThrow(/secret env var/i)
  })

  it("emits simpleIngress when domain provided", () => {
    const out = buildHelmValues({
      slug: "s",
      imageRepository: "r",
      imageTag: "1",
      env: [],
      domain: "example.com",
    })
    expect(out.simpleIngress).toEqual([
      {
        enabled: true,
        domain: "example.com",
        tls: true,
        className: "haproxy",
        certManager: { enabled: true, issuer: "production" },
      },
    ])
  })
  it("renders managed edge TLS and enabled allowlist CIDRs", () => {
    const out = buildHelmValues({
      slug: "s",
      imageRepository: "r",
      imageTag: "1",
      env: [],
      edge: {
        domain: "managed.example.com",
        certificateSource: "MANAGED",
        certificateStatus: "ACTIVE",
        allowlistMode: "ALLOWLIST_ONLY",
        enabledCidrs: ["10.0.0.0/8", "2001:db8::/32"],
      },
    })

    expect(out.simpleIngress).toEqual([
      {
        enabled: true,
        domain: "managed.example.com",
        tls: true,
        className: "haproxy",
        certManager: { enabled: true, issuer: "production" },
        annotations: {
          "haproxy-ingress.github.io/whitelist-source-range":
            "10.0.0.0/8,2001:db8::/32",
        },
      },
    ])
  })

  it("renders an uploaded TLS secret without cert-manager", () => {
    const out = buildHelmValues({
      slug: "s",
      imageRepository: "r",
      imageTag: "1",
      env: [],
      edge: {
        domain: "custom.example.com",
        certificateSource: "UPLOADED",
        certificateStatus: "ACTIVE",
        certificateSecretName: "domain-tls",
      },
    })

    expect(out.simpleIngress).toEqual([
      {
        enabled: true,
        domain: "custom.example.com",
        tls: true,
        tlsSecretName: "domain-tls",
        className: "haproxy",
      },
    ])
  })

  it("omits allowlist annotation for OPEN or when all entries are disabled", () => {
    const open = buildHelmValues({
      slug: "s",
      imageRepository: "r",
      imageTag: "1",
      env: [],
      edge: {
        domain: "open.example.com",
        certificateSource: "MANAGED",
        allowlistMode: "OPEN",
        enabledCidrs: ["10.0.0.0/8"],
      },
    })
    const disabled = buildHelmValues({
      slug: "s",
      imageRepository: "r",
      imageTag: "1",
      env: [],
      edge: {
        domain: "disabled.example.com",
        certificateSource: "MANAGED",
        allowlistMode: "ALLOWLIST_ONLY",
        enabledCidrs: [],
      },
    })

    expect((open.simpleIngress as any)[0].annotations).toBeUndefined()
    expect((disabled.simpleIngress as any)[0].annotations).toBeUndefined()
  })

  it("appends additionalContainerPorts to containerPorts, keeping the primary port first", () => {
    const out = buildHelmValues({
      slug: "hermes-agent",
      imageRepository: "nousresearch/hermes-agent",
      imageTag: "v2026.8.18",
      env: [],
      containerPort: 8642,
      deploymentType: "statefulset",
      additionalContainerPorts: [{ port: 9119, name: "dashboard" }],
    })

    expect(out.containerPorts).toEqual([
      { containerPort: 8642, name: "http" },
      { containerPort: 9119, name: "dashboard" },
    ])
    expect(out.deploymentType).toBe("statefulset")
    expect((out.service as Record<string, unknown>).port).toBe(8642)
    expect((out.service as Record<string, unknown>).targetPort).toBe(8642)
  })

  it("defaults deploymentType to deployment and containerPorts to a single entry", () => {
    const out = buildHelmValues({
      slug: "s",
      imageRepository: "r",
      imageTag: "1",
      env: [],
      containerPort: 80,
    })

    expect(out.deploymentType).toBe("deployment")
    expect(out.containerPorts).toEqual([{ containerPort: 80, name: "http" }])
  })

  it("omits env, externalSecret, simpleIngress, and simpleStorage when not applicable", () => {
    const out = buildHelmValues({
      slug: "s",
      imageRepository: "r",
      imageTag: "1",
      env: [],
    })
    expect("env" in out).toBe(false)
    expect("externalSecret" in out).toBe(false)
    expect("simpleIngress" in out).toBe(false)
    expect("simpleStorage" in out).toBe(false)
  })
  it("prefixes app.name with app- and sets fullnameOverride when slug starts with a number for RFC 1035 compliance", () => {
    const out = buildHelmValues({
      slug: "9router-daring-pulsar",
      imageRepository: "ghcr.io/decolua/9router",
      imageTag: "latest",
      env: [],
    })
    expect(out.app).toEqual({ name: "app-9router-daring-pulsar" })
    expect(out.fullnameOverride).toBe("app-9router-daring-pulsar-deploy")
  })

  it("renders simpleStorage with path, size, and accessMode when storage is enabled", () => {
    const out = buildHelmValues({
      slug: "hermes-sparkling-pulsar",
      imageRepository: "nousresearch/hermes-agent",
      imageTag: "v2026.8.18",
      env: [],
      storage: {
        enabled: true,
        mountPath: "/opt/data",
        size: "2Gi",
        accessMode: "ReadWriteOnce",
      },
    })

    expect(out.simpleStorage).toEqual([
      {
        name: "data",
        path: "/opt/data",
        size: "2Gi",
        accessMode: "ReadWriteOnce",
        accessModes: ["ReadWriteOnce"],
      },
    ])
  })

  it("renders simpleStorage supporting explicit path, name, and storageClassName", () => {
    const out = buildHelmValues({
      slug: "app-custom",
      imageRepository: "custom/app",
      imageTag: "1.0",
      env: [],
      storage: {
        enabled: true,
        name: "custom-data",
        path: "/var/custom",
        size: "5Gi",
        accessMode: "ReadWriteMany",
        storageClass: "fast-storage",
      },
    })

    expect(out.simpleStorage).toEqual([
      {
        name: "custom-data",
        path: "/var/custom",
        size: "5Gi",
        accessMode: "ReadWriteMany",
        accessModes: ["ReadWriteMany"],
        class: "fast-storage",
        storageClassName: "fast-storage",
      },
    ])
  })

  it("omits simpleStorage when storage.enabled is false", () => {
    const out = buildHelmValues({
      slug: "s",
      imageRepository: "r",
      imageTag: "1",
      env: [],
      storage: {
        enabled: false,
        mountPath: "/opt/data",
      },
    })
    expect("simpleStorage" in out).toBe(false)
  })

  it("renders podSecurityContext with fsGroup when fsGroup is set directly or on storage", () => {
    const direct = buildHelmValues({
      slug: "app-fsgroup",
      imageRepository: "custom/app",
      imageTag: "1.0",
      env: [],
      fsGroup: 10000,
    })
    expect(direct.podSecurityContext).toEqual({ fsGroup: 10000 })

    const fromStorage = buildHelmValues({
      slug: "app-storage-fsgroup",
      imageRepository: "custom/app",
      imageTag: "1.0",
      env: [],
      storage: {
        enabled: true,
        mountPath: "/opt/data",
        fsGroup: 20000,
      },
    })
    expect(fromStorage.podSecurityContext).toEqual({ fsGroup: 20000 })
  })
})

describe("Helm fluent builder", () => {
  it("chains Helm.values() methods to produce valid configuration", () => {
    const values = Helm.values()
      .app({ name: "my-app", version: "2.12.4" })
      .image({ repository: "docker.io/n8nio/n8n", tag: "latest" })
      .replicas(2)
      .deploymentType("deployment")
      .resources({
        requests: { cpu: "250m", memory: "512Mi" },
        limits: { cpu: "1000m", memory: "2048Mi" },
      })
      .service({ port: 5678, targetPort: 5678 })
      .env([
        { name: "NODE_ENV", value: "production" },
        { name: "N8N_ENCRYPTION_KEY", value: "secret123" },
      ])
      .externalSecret({
        vaultPath: "tenants/org/stacks/app/prod/app-env",
        autoEnvFrom: true,
        refreshInterval: "24h",
      })
      .simpleIngress({
        domain: "app.example.com",
        tls: true,
        certIssuer: "production",
      })
      .simpleStorage({
        enabled: true,
        path: "/data",
        size: "20Gi",
        storageClass: "fast-ssd",
      })
      .reloader(true)
      .logging(true)
      .podAnnotations({
        "reloader.stakater.com/auto": "true",
      })
      .build()

    expect(values.app).toEqual({ name: "my-app", version: "2.12.4" })
    expect(values.image).toEqual({
      repository: "docker.io/n8nio/n8n",
      tag: "latest",
    })
    expect(values.replicaCount).toBe(2)
    expect(values.deploymentType).toBe("deployment")
    expect(values.externalSecret).toEqual({
      enabled: true,
      secretStoreRef: { kind: "ClusterSecretStore", name: "vault-backend" },
      dataFrom: [{ extract: { key: "tenants/org/stacks/app/prod/app-env" } }],
      autoEnvFrom: true,
      refreshInterval: "24h",
    })
    expect(values.reloader).toEqual({ enabled: true })
    expect(values.logging).toEqual({ enabled: true })
    expect(values.podAnnotations).toEqual({
      "reloader.stakater.com/auto": "true",
    })
    expect(values.simpleStorage).toEqual([
      {
        name: "data",
        path: "/data",
        size: "20Gi",
        accessMode: "ReadWriteOnce",
        accessModes: ["ReadWriteOnce"],
        class: "fast-ssd",
        storageClassName: "fast-ssd",
      },
    ])
  })

  it("renders ArgoCD Helm Application manifest via Helm.chart() with 2.12.4 default", () => {
    const yaml = Helm.chart()
      .appName("test-app")
      .gitopsRepoUrl("https://github.com/pfnapp/gitops.git")
      .branch("main")
      .valueFilePath("services-yaml/test-app/value.yml")
      .namespace("app-test")
      .toYaml()

    expect(yaml).toContain("name: test-app")
    expect(yaml).toContain("targetRevision: 2.12.4")
    expect(yaml).toContain("repoURL: https://pfnapp.github.io/charts")
  })
  it("fromInput automatically populates podAnnotations and logging when enabled", () => {
    const values = buildHelmValues({
      slug: "logging-test",
      imageRepository: "nginx",
      imageTag: "latest",
      env: [],
      reloader: true,
      logging: true,
    })

    expect(values.logging).toEqual({ enabled: true })
    expect(values.reloader).toEqual({ enabled: true })
    expect(values.podAnnotations).toEqual({
      "reloader.stakater.com/auto": "true",
    })
  })
})
