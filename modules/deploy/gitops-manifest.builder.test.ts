import { describe, expect, it } from "bun:test"
import * as jsYaml from "js-yaml"
import {
  buildArgoCdProjectManifest,
  buildHelmApplicationManifest,
  formatTenantFolder,
  resolveGitOpsManifestPaths,
} from "./gitops-manifest.builder"

describe("gitops-manifest.builder", () => {
  describe("resolveGitOpsManifestPaths", () => {
    describe("formatTenantFolder", () => {
      it("transforms org_ prefix to app- in lowercase", () => {
        expect(formatTenantFolder("org_01KS2FV9E85ERH10HHT7XT0P0G")).toBe(
          "app-01ks2fv9e85erh10hht7xt0p0g"
        )
        expect(formatTenantFolder("org_acme")).toBe("app-acme")
      })

      it("preserves or adds app- prefix if already present or not", () => {
        expect(formatTenantFolder("app-myteam")).toBe("app-myteam")
        expect(formatTenantFolder("myteam")).toBe("app-myteam")
      })

      it("falls back to slug when orgId is null", () => {
        expect(formatTenantFolder(null, "my-slug")).toBe("app-my-slug")
        expect(formatTenantFolder(null, "app-my-slug")).toBe("app-my-slug")
        expect(formatTenantFolder(null, null)).toBe("app-default")
      })
    })

    describe("resolveGitOpsManifestPaths with organizationId", () => {
      it("resolves paths under services-yaml/app-${orgId}/${slug}/helm.yml", () => {
        const paths = resolveGitOpsManifestPaths({
          slug: "hermes-swift-pulsar",
          organizationId: "org_01KS2FV9E85ERH10HHT7XT0P0G",
          basePath: "services-yaml/{slug}",
        })

        expect(paths.appSlug).toBe("app-01ks2fv9e85erh10hht7xt0p0g")
        expect(paths.namespace).toBe("app-01ks2fv9e85erh10hht7xt0p0g")
        expect(paths.appServicesDir).toBe(
          "services-yaml/app-01ks2fv9e85erh10hht7xt0p0g"
        )
        expect(paths.serviceDir).toBe(
          "services-yaml/app-01ks2fv9e85erh10hht7xt0p0g/hermes-swift-pulsar"
        )
        expect(paths.argocdProjectPath).toBe(
          "argocd-projects/app-01ks2fv9e85erh10hht7xt0p0g.yml"
        )
        expect(paths.helmPath).toBe(
          "services-yaml/app-01ks2fv9e85erh10hht7xt0p0g/hermes-swift-pulsar/helm.yml"
        )
        expect(paths.valuePath).toBe(
          "services-yaml/app-01ks2fv9e85erh10hht7xt0p0g/hermes-swift-pulsar/value.yml"
        )
      })
    })

    it("resolves paths for slug without app- prefix", () => {
      const paths = resolveGitOpsManifestPaths({
        slug: "hermes-swift-pulsar",
        basePath: "services-yaml/{slug}",
      })

      expect(paths.appSlug).toBe("app-hermes-swift-pulsar")
      expect(paths.namespace).toBe("app-hermes-swift-pulsar")
      expect(paths.appServicesDir).toBe("services-yaml/app-hermes-swift-pulsar")
      expect(paths.serviceDir).toBe(
        "services-yaml/app-hermes-swift-pulsar/hermes-swift-pulsar"
      )
      expect(paths.argocdProjectPath).toBe(
        "argocd-projects/app-hermes-swift-pulsar.yml"
      )
      expect(paths.helmPath).toBe(
        "services-yaml/app-hermes-swift-pulsar/hermes-swift-pulsar/helm.yml"
      )
      expect(paths.valuePath).toBe(
        "services-yaml/app-hermes-swift-pulsar/hermes-swift-pulsar/value.yml"
      )
    })

    it("resolves paths for slug already starting with app-", () => {
      const paths = resolveGitOpsManifestPaths({
        slug: "app-metacard-prod",
        basePath: "services-yaml/{slug}",
      })

      expect(paths.appSlug).toBe("app-metacard-prod")
      expect(paths.namespace).toBe("app-metacard-prod")
      expect(paths.appServicesDir).toBe("services-yaml/app-metacard-prod")
      expect(paths.serviceDir).toBe(
        "services-yaml/app-metacard-prod/app-metacard-prod"
      )
      expect(paths.argocdProjectPath).toBe(
        "argocd-projects/app-metacard-prod.yml"
      )
      expect(paths.helmPath).toBe(
        "services-yaml/app-metacard-prod/app-metacard-prod/helm.yml"
      )
      expect(paths.valuePath).toBe(
        "services-yaml/app-metacard-prod/app-metacard-prod/value.yml"
      )
    })

    it("handles basePath without {slug} placeholder", () => {
      const paths = resolveGitOpsManifestPaths({
        slug: "my-app",
        basePath: "services-yaml",
      })

      expect(paths.appSlug).toBe("app-my-app")
      expect(paths.appServicesDir).toBe("services-yaml/app-my-app")
      expect(paths.serviceDir).toBe("services-yaml/app-my-app/my-app")
      expect(paths.helmPath).toBe("services-yaml/app-my-app/my-app/helm.yml")
      expect(paths.valuePath).toBe("services-yaml/app-my-app/my-app/value.yml")
    })
    it("falls back to services-yaml prefix when basePath is empty", () => {
      const paths = resolveGitOpsManifestPaths({
        slug: "my-app",
        basePath: "",
      })

      expect(paths.appServicesDir).toBe("services-yaml/app-my-app")
    })
  })

  describe("buildArgoCdProjectManifest", () => {
    it("generates a valid ArgoCD Application watching servicesPath", () => {
      const yaml = buildArgoCdProjectManifest({
        appSlug: "app-hermes-swift-pulsar",
        repoUrl: "https://github.com/pfnapp/sgp-argocd-prod.git",
        branch: "main",
        servicesPath: "services-yaml/app-hermes-swift-pulsar",
        namespace: "app-hermes-swift-pulsar",
      })

      const parsed = jsYaml.load(yaml) as Record<string, unknown>
      const spec = parsed["spec"] as Record<string, unknown>
      const metadata = parsed["metadata"] as Record<string, unknown>
      const source = spec["source"] as Record<string, unknown>
      const destination = spec["destination"] as Record<string, unknown>
      const syncPolicy = spec["syncPolicy"] as Record<string, unknown>
      const automated = syncPolicy["automated"] as Record<string, unknown>

      expect(parsed["apiVersion"]).toBe("argoproj.io/v1alpha1")
      expect(parsed["kind"]).toBe("Application")
      expect(metadata["name"]).toBe("app-hermes-swift-pulsar")
      expect(metadata["namespace"]).toBe("argocd")
      expect(source["repoURL"]).toBe(
        "https://github.com/pfnapp/sgp-argocd-prod.git"
      )
      expect(source["targetRevision"]).toBe("main")
      expect(source["path"]).toBe("services-yaml/app-hermes-swift-pulsar")
      expect(source["directory"]).toEqual({ recurse: true })
      expect(destination["namespace"]).toBe("app-hermes-swift-pulsar")
      expect(automated["prune"]).toBe(true)
      expect(automated["selfHeal"]).toBe(true)
    })
  })

  describe("buildHelmApplicationManifest", () => {
    it("generates a multi-source ArgoCD Application pointing to Helm deploy chart and value.yml", () => {
      const yaml = buildHelmApplicationManifest({
        appName: "hermes-swift-pulsar",
        gitopsRepoUrl: "https://github.com/pfnapp/sgp-argocd-prod.git",
        branch: "main",
        valueFilePath:
          "services-yaml/app-hermes-swift-pulsar/hermes-swift-pulsar/value.yml",
        namespace: "app-hermes-swift-pulsar",
      })

      const parsed = jsYaml.load(yaml) as Record<string, unknown>
      const metadata = parsed["metadata"] as Record<string, unknown>
      const spec = parsed["spec"] as Record<string, unknown>
      const sources = spec["sources"] as Array<Record<string, unknown>>
      const destination = spec["destination"] as Record<string, unknown>
      const syncPolicy = spec["syncPolicy"] as Record<string, unknown>
      const automated = syncPolicy["automated"] as Record<string, unknown>

      expect(parsed["apiVersion"]).toBe("argoproj.io/v1alpha1")
      expect(parsed["kind"]).toBe("Application")
      expect(metadata["name"]).toBe("hermes-swift-pulsar")
      expect(metadata["namespace"]).toBe("argocd")
      expect(sources).toHaveLength(2)

      const helmSource = sources[0]
      const helmConfig = helmSource?.["helm"] as Record<string, unknown>
      expect(helmSource?.["repoURL"]).toBe("https://pfnapp.github.io/charts")
      expect(helmSource?.["chart"]).toBe("deploy")
      expect(helmSource?.["targetRevision"]).toBe("2.10.0")
      expect(helmConfig?.["valueFiles"]).toEqual([
        "$repoValue/services-yaml/app-hermes-swift-pulsar/hermes-swift-pulsar/value.yml",
      ])

      const gitopsSource = sources[1]
      expect(gitopsSource?.["repoURL"]).toBe(
        "https://github.com/pfnapp/sgp-argocd-prod.git"
      )
      expect(gitopsSource?.["targetRevision"]).toBe("main")
      expect(gitopsSource?.["ref"]).toBe("repoValue")

      expect(destination["namespace"]).toBe("app-hermes-swift-pulsar")
      expect(automated["selfHeal"]).toBe(true)
    })
  })
})
