import type { AppManifest, KubernetesResource } from "./gitops.types"

export type AppDescriptor = {
  name: string
  namespace?: string
  teamSlug?: string
  replicas?: number
  image: string
  port?: number
  host?: string
}

export class YamlManifestGenerator {
  generateDeploymentYaml(app: AppDescriptor): KubernetesResource {
    return {
      apiVersion: "apps/v1",
      kind: "Deployment",
      metadata: {
        name: app.name,
        namespace: app.namespace ?? "default",
        labels: { app: app.name },
      },
      spec: {
        replicas: app.replicas ?? 1,
        selector: { matchLabels: { app: app.name } },
        template: {
          metadata: { labels: { app: app.name } },
          spec: {
            containers: [
              {
                name: app.name,
                image: app.image,
                ports: [{ containerPort: app.port ?? 80 }],
              },
            ],
          },
        },
      },
    }
  }

  generateServiceYaml(app: AppDescriptor): KubernetesResource {
    return {
      apiVersion: "v1",
      kind: "Service",
      metadata: {
        name: app.name,
        namespace: app.namespace ?? "default",
      },
      spec: {
        selector: { app: app.name },
        ports: [{ port: 80, targetPort: app.port ?? 80 }],
        type: "ClusterIP",
      },
    }
  }

  generateIngressYaml(app: AppDescriptor): KubernetesResource {
    return {
      apiVersion: "networking.k8s.io/v1",
      kind: "Ingress",
      metadata: {
        name: app.name,
        namespace: app.namespace ?? "default",
        annotations: {
          "kubernetes.io/ingress.class": "nginx",
        },
      },
      spec: {
        rules: [
          {
            host: app.host ?? "",
            http: {
              paths: [
                {
                  path: "/",
                  pathType: "Prefix",
                  backend: {
                    service: {
                      name: app.name,
                      port: { number: 80 },
                    },
                  },
                },
              ],
            },
          },
        ],
      },
    }
  }

  generateHelmChartYaml(app: AppDescriptor): Record<string, unknown> {
    return {
      apiVersion: "v2",
      name: app.name,
      description: `A Helm chart for ${app.name}`,
      type: "application",
      version: "0.1.0",
      appVersion: "1.0.0",
    }
  }

  generateAllManifests(app: AppDescriptor): AppManifest {
    const resources: KubernetesResource[] = [
      this.generateDeploymentYaml(app),
      this.generateServiceYaml(app),
    ]

    if (app.host) {
      resources.push(this.generateIngressYaml(app))
    }

    return {
      appName: app.name,
      teamSlug: app.teamSlug ?? "default",
      namespace: app.namespace ?? "default",
      resources,
    }
  }
}