import { describe, expect, it } from "bun:test"
import {
  YamlManifestGenerator,
  type AppDescriptor,
} from "./yaml-manifest.service"

describe("YamlManifestGenerator", () => {
  const generator = new YamlManifestGenerator()

  const basicApp: AppDescriptor = {
    name: "web-app",
    image: "ghcr.io/org/web-app:v1.0.0",
  }

  describe("generateDeploymentYaml", () => {
    it("generates standard deployment with default values", () => {
      const deployment = generator.generateDeploymentYaml(basicApp)

      expect(deployment.apiVersion).toBe("apps/v1")
      expect(deployment.kind).toBe("Deployment")
      expect(deployment.metadata).toEqual({
        name: "web-app",
        namespace: "default",
        labels: { app: "web-app" },
      })

      const spec = deployment.spec as {
        replicas: number
        selector: { matchLabels: { app: string } }
        template: {
          metadata: { labels: { app: string } }
          spec: {
            containers: Array<{
              name: string
              image: string
              ports: Array<{ containerPort: number }>
              livenessProbe: {
                httpGet: { path: string; port: number }
                initialDelaySeconds: number
                periodSeconds: number
              }
              readinessProbe: {
                httpGet: { path: string; port: number }
                initialDelaySeconds: number
                periodSeconds: number
              }
            }>
          }
        }
      }

      expect(spec.replicas).toBe(1)
      expect(spec.selector.matchLabels).toEqual({ app: "web-app" })
      expect(spec.template.metadata.labels).toEqual({ app: "web-app" })
      expect(spec.template.spec.containers).toHaveLength(1)

      const container = spec.template.spec.containers[0]
      expect(container.name).toBe("web-app")
      expect(container.image).toBe("ghcr.io/org/web-app:v1.0.0")
      expect(container.ports).toEqual([{ containerPort: 80 }])
      expect(container.livenessProbe).toEqual({
        httpGet: { path: "/healthz", port: 80 },
        initialDelaySeconds: 15,
        periodSeconds: 10,
      })
      expect(container.readinessProbe).toEqual({
        httpGet: { path: "/healthz", port: 80 },
        initialDelaySeconds: 5,
        periodSeconds: 5,
      })
    })

    it("generates custom deployment with explicit configuration", () => {
      const customApp: AppDescriptor = {
        name: "api-service",
        namespace: "production",
        teamSlug: "core-team",
        replicas: 4,
        image: "registry.example.com/api:v2.5.0",
        port: 8080,
        host: "api.example.com",
        healthCheckPath: "/api/v1/health",
      }

      const deployment = generator.generateDeploymentYaml(customApp)

      expect(deployment.metadata.name).toBe("api-service")
      expect(deployment.metadata.namespace).toBe("production")

      const spec = deployment.spec as {
        replicas: number
        template: {
          spec: {
            containers: Array<{
              name: string
              image: string
              ports: Array<{ containerPort: number }>
              livenessProbe: { httpGet: { path: string; port: number } }
              readinessProbe: { httpGet: { path: string; port: number } }
            }>
          }
        }
      }

      expect(spec.replicas).toBe(4)
      const container = spec.template.spec.containers[0]
      expect(container.name).toBe("api-service")
      expect(container.image).toBe("registry.example.com/api:v2.5.0")
      expect(container.ports).toEqual([{ containerPort: 8080 }])
      expect(container.livenessProbe.httpGet).toEqual({
        path: "/api/v1/health",
        port: 8080,
      })
      expect(container.readinessProbe.httpGet).toEqual({
        path: "/api/v1/health",
        port: 8080,
      })
    })
  })

  describe("generateServiceYaml", () => {
    it("generates ClusterIP service with default port 80", () => {
      const svc = generator.generateServiceYaml(basicApp)

      expect(svc.apiVersion).toBe("v1")
      expect(svc.kind).toBe("Service")
      expect(svc.metadata).toEqual({
        name: "web-app",
        namespace: "default",
      })
      expect(svc.spec).toEqual({
        selector: { app: "web-app" },
        ports: [{ port: 80, targetPort: 80 }],
        type: "ClusterIP",
      })
    })

    it("generates service with custom namespace and targetPort", () => {
      const customApp: AppDescriptor = {
        name: "worker",
        namespace: "staging",
        image: "worker:latest",
        port: 3000,
      }

      const svc = generator.generateServiceYaml(customApp)

      expect(svc.metadata.namespace).toBe("staging")
      expect(svc.spec).toEqual({
        selector: { app: "worker" },
        ports: [{ port: 80, targetPort: 3000 }],
        type: "ClusterIP",
      })
    })
  })

  describe("generateIngressYaml", () => {
    it("generates Ingress manifest with default host empty and nginx annotation", () => {
      const ingress = generator.generateIngressYaml(basicApp)

      expect(ingress.apiVersion).toBe("networking.k8s.io/v1")
      expect(ingress.kind).toBe("Ingress")
      expect(ingress.metadata).toEqual({
        name: "web-app",
        namespace: "default",
        annotations: {
          "kubernetes.io/ingress.class": "nginx",
        },
      })
      expect(ingress.spec).toEqual({
        rules: [
          {
            host: "",
            http: {
              paths: [
                {
                  path: "/",
                  pathType: "Prefix",
                  backend: {
                    service: {
                      name: "web-app",
                      port: { number: 80 },
                    },
                  },
                },
              ],
            },
          },
        ],
      })
    })

    it("generates Ingress manifest with specified host and namespace", () => {
      const customApp: AppDescriptor = {
        name: "dashboard",
        namespace: "analytics",
        image: "dashboard:1.0",
        host: "dashboard.example.com",
      }

      const ingress = generator.generateIngressYaml(customApp)

      expect(ingress.metadata.namespace).toBe("analytics")
      const spec = ingress.spec as {
        rules: Array<{ host: string; http: { paths: unknown[] } }>
      }
      expect(spec.rules[0].host).toBe("dashboard.example.com")
    })
  })

  describe("generateHelmChartYaml", () => {
    it("generates Chart.yaml metadata object", () => {
      const chart = generator.generateHelmChartYaml(basicApp)

      expect(chart).toEqual({
        apiVersion: "v2",
        name: "web-app",
        description: "A Helm chart for web-app",
        type: "application",
        version: "0.1.0",
        appVersion: "1.0.0",
      })
    })
  })

  describe("generateAllManifests", () => {
    it("generates AppManifest without Ingress when host is not provided", () => {
      const manifest = generator.generateAllManifests(basicApp)

      expect(manifest.appName).toBe("web-app")
      expect(manifest.teamSlug).toBe("default")
      expect(manifest.namespace).toBe("default")
      expect(manifest.resources).toHaveLength(2)

      const kinds = manifest.resources.map((r) => r.kind)
      expect(kinds).toEqual(["Deployment", "Service"])
    })

    it("generates AppManifest with Ingress when host is provided", () => {
      const appWithHost: AppDescriptor = {
        name: "frontend",
        namespace: "prod",
        teamSlug: "marketing",
        image: "frontend:prod",
        host: "app.example.com",
        port: 80,
      }

      const manifest = generator.generateAllManifests(appWithHost)

      expect(manifest.appName).toBe("frontend")
      expect(manifest.teamSlug).toBe("marketing")
      expect(manifest.namespace).toBe("prod")
      expect(manifest.resources).toHaveLength(3)

      const kinds = manifest.resources.map((r) => r.kind)
      expect(kinds).toEqual(["Deployment", "Service", "Ingress"])
    })
  })
})
