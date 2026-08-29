import { describe, it, expect } from "bun:test"
import { buildHelmValues } from "./helm-values.builder"

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
      limits: { cpu: "1000m", memory: "4096Mi" },
    })
    expect(out.env).toBeUndefined()
    expect(out.externalSecret).toBeUndefined()
    expect(out.simpleIngress).toBeUndefined()
  })

  it("uses provided cpu/memory and applies resource floors", () => {
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
      limits: { cpu: "1000m", memory: "4096Mi" },
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

  it("omits env, externalSecret, and simpleIngress when not applicable", () => {
    const out = buildHelmValues({
      slug: "s",
      imageRepository: "r",
      imageTag: "1",
      env: [],
    })
    expect("env" in out).toBe(false)
    expect("externalSecret" in out).toBe(false)
    expect("simpleIngress" in out).toBe(false)
  })
})
