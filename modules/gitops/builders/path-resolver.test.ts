import { describe, it, expect } from "bun:test"
import { ManifestPathResolver } from "./path-resolver"

describe("ManifestPathResolver", () => {
  it("generates correct paths per container", () => {
    const resolver = new ManifestPathResolver({
      tenant: "acme",
      stack: "production",
      container: "web",
    })

    expect(resolver.getConfigMapPath()).toBe("services-yaml/acme/production/web/configmap.yml")
    expect(resolver.getSecretPath()).toBe("services-yaml/acme/production/web/secret.yml")
    expect(resolver.getDeploymentPath()).toBe("services-yaml/acme/production/web/deployment.yml")
    expect(resolver.getServicePath()).toBe("services-yaml/acme/production/web/service.yml")
    expect(resolver.getHPAPath()).toBe("services-yaml/acme/production/web/hpa.yml")
  })

  it("generates paths with custom base path", () => {
    const resolver = new ManifestPathResolver({
      tenant: "acme",
      stack: "staging",
      container: "api",
      basePath: "k8s",
    })

    expect(resolver.getConfigMapPath()).toBe("k8s/acme/staging/api/configmap.yml")
  })

  it("returns all manifest paths", () => {
    const resolver = new ManifestPathResolver({
      tenant: "acme",
      stack: "prod",
      container: "worker",
    })

    const paths = resolver.getAllPaths()
    expect(paths).toContainEqual({ kind: "ConfigMap", path: "services-yaml/acme/prod/worker/configmap.yml" })
    expect(paths).toContainEqual({ kind: "Secret", path: "services-yaml/acme/prod/worker/secret.yml" })
    expect(paths).toContainEqual({ kind: "Deployment", path: "services-yaml/acme/prod/worker/deployment.yml" })
    expect(paths).toContainEqual({ kind: "Service", path: "services-yaml/acme/prod/worker/service.yml" })
    expect(paths).toContainEqual({ kind: "HPA", path: "services-yaml/acme/prod/worker/hpa.yml" })
  })
})
