import { describe, expect, it } from "bun:test"

import {
  argocdMetadataSchema,
  formStateToPayload,
  gitopsMetadataSchema,
  INTEGRATION_TYPES,
  jenkinsMetadataSchema,
  kubeconfigMetadataSchema,
  opensearchMetadataSchema,
  prometheusMetadataSchema,
} from "./cluster-integration.schema"

describe("cluster integration schemas", () => {
  it("supports all admin integration types", () => {
    expect(INTEGRATION_TYPES).toEqual([
      "JENKINS",
      "GITOPS",
      "REGISTRY",
      "ARGOCD",
      "KUBECONFIG",
      "OPENSEARCH",
      "PROMETHEUS",
    ])
  })

  it("requires Jenkins metadata", () => {
    expect(jenkinsMetadataSchema.safeParse({}).success).toBe(false)
    expect(
      jenkinsMetadataSchema.safeParse({
        baseUrl: "https://jenkins.example.com",
        dslOwner: "pfnapp",
        dslRepo: "Jenkins",
        gitCredentialId: "github-token",
      }).success
    ).toBe(true)
  })

  it("validates GitOps repository and slug path", () => {
    expect(
      gitopsMetadataSchema.safeParse({
        repo: "invalid",
        branch: "main",
        basePath: "services-yaml/{slug}",
      }).success
    ).toBe(false)
    expect(
      gitopsMetadataSchema.safeParse({
        repo: "pfnapp/argocd",
        branch: "main",
        basePath: "services-yaml/{slug}",
      }).success
    ).toBe(true)
  })

  it("rejects unknown metadata keys", () => {
    expect(
      argocdMetadataSchema.safeParse({
        apiUrl: "https://argocd.example.com",
        project: "default",
        appNamespace: "argocd",
        unexpected: true,
      }).success
    ).toBe(false)
  })

  it("validates Kubeconfig placeholder and OpenSearch values", () => {
    expect(
      kubeconfigMetadataSchema.safeParse({
        namespacePattern: "app-{name}",
        labelSelector: "app={slug}",
      }).success
    ).toBe(false)
    expect(
      opensearchMetadataSchema.safeParse({
        host: "https://search.example.com",
        sslVerify: true,
        timeout: 30,
      }).success
    ).toBe(true)
  })

  it("validates Prometheus endpoint", () => {
    expect(
      prometheusMetadataSchema.safeParse({ endpoint: "not-a-url" }).success
    ).toBe(false)
  })

  it("maps form state into metadata and write-only secret payloads", () => {
    expect(
      formStateToPayload({
        baseUrl: "https://jenkins.example.com",
        secret_username: "jenkins",
        secret_apiToken: "token",
        optional: "",
      })
    ).toEqual({
      metaJson: { baseUrl: "https://jenkins.example.com" },
      secrets: { username: "jenkins", apiToken: "token" },
    })
  })
})
