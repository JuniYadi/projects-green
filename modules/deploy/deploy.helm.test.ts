import { describe, it, expect } from "bun:test"
import * as jsYaml from "js-yaml"
import {
  DeploymentBuilder,
  generateHelmInstallCommand,
  generateHelmUpgradeCommand,
  helmValuesToYaml,
  type ApplicationHelmValues,
  type EnvVar,
  type Port,
  type Probe,
  type ResourceRequirements,
  type Toleration,
  type VolumeMount,
} from "./deploy.helm"

interface K8sContainer {
  name: string
  image: string
  ports: Port[]
  env: EnvVar[]
  resources: ResourceRequirements
  volumeMounts: VolumeMount[]
  livenessProbe?: Probe
  readinessProbe?: Probe
  startupProbe?: Probe
  securityContext?: unknown
}

interface K8sPodSpec {
  containers: K8sContainer[]
  volumes?: unknown[]
  nodeSelector?: Record<string, string>
  tolerations?: Toleration[]
  affinity?: Record<string, unknown>
  securityContext?: unknown
  serviceAccountName?: string
}

interface K8sDeploymentManifest {
  apiVersion: string
  kind: string
  metadata: {
    name: string
    namespace: string
    labels: Record<string, string>
  }
  spec: {
    replicas: number
    selector: { matchLabels: Record<string, string> }
    template: {
      metadata: { labels: Record<string, string> }
      spec: K8sPodSpec
    }
  }
}

describe("deploy.helm", () => {
  describe("DeploymentBuilder", () => {
    describe("fluent setters and defaults", () => {
      it("constructs with default properties and builds valid apps/v1 Deployment and HelmValues", () => {
        const builder = new DeploymentBuilder("my-app", "prod-namespace")
        const result = builder.build()

        const k8s = result.content as K8sDeploymentManifest
        expect(k8s.apiVersion).toBe("apps/v1")
        expect(k8s.kind).toBe("Deployment")
        expect(k8s.metadata).toEqual({
          name: "my-app",
          namespace: "prod-namespace",
          labels: { app: "my-app" },
        })
        expect(k8s.spec.replicas).toBe(1)
        expect(k8s.spec.selector).toEqual({ matchLabels: { app: "my-app" } })
        expect(k8s.spec.template.metadata.labels).toEqual({ app: "my-app" })

        // Default container ports and resources
        const defaultContainer = k8s.spec.template.spec.containers[0]
        expect(defaultContainer.name).toBe("my-app")
        expect(defaultContainer.image).toBe("")
        expect(defaultContainer.ports).toEqual([
          { name: "http", containerPort: 8080, protocol: "TCP" },
        ])
        expect(defaultContainer.resources).toEqual({
          requests: { cpu: "100m", memory: "128Mi" },
          limits: { cpu: "500m", memory: "512Mi" },
        })
        expect(defaultContainer.env).toEqual([])
        expect(defaultContainer.volumeMounts).toEqual([])

        // Helm values
        const helm = result.helm.deployment
        expect(helm.enabled).toBe(true)
        expect(helm.name).toBe("my-app")
        expect(helm.image).toEqual({
          repository: "",
          tag: "latest",
          pullPolicy: "IfNotPresent",
        })
        expect(helm.replicaCount).toBe(1)
        expect(helm.resources).toEqual({
          requests: { cpu: "100m", memory: "128Mi" },
          limits: { cpu: "500m", memory: "512Mi" },
        })
        expect(helm.ports).toEqual([
          { name: "http", containerPort: 8080, protocol: "TCP" },
        ])
        expect(helm.serviceAccount).toEqual({ name: "" })
        expect(helm.probes).toEqual({
          liveness: {},
          readiness: {},
          startup: {},
        })
      })

      it("sets image with repo and tag correctly", () => {
        const builder = new DeploymentBuilder("api", "default").setImage(
          "ghcr.io/org/repo:v1.2.3"
        )

        const result = builder.build()
        const helm = result.helm.deployment
        expect(helm.image.repository).toBe("ghcr.io/org/repo")
        expect(helm.image.tag).toBe("v1.2.3")

        const k8s = result.content as K8sDeploymentManifest
        expect(k8s.spec.template.spec.containers[0].image).toBe(
          "ghcr.io/org/repo:v1.2.3"
        )
      })

      it("sets image without tag defaulting to latest in helm values", () => {
        const builder = new DeploymentBuilder("api", "default").setImage(
          "redis"
        )

        const result = builder.build()
        expect(result.helm.deployment.image.repository).toBe("redis")
        expect(result.helm.deployment.image.tag).toBe("latest")
      })

      it("sets replicas, env, ports, resources, labels, nodeSelector, tolerations, and affinity", () => {
        const envVars: EnvVar[] = [
          { name: "NODE_ENV", value: "production" },
          { name: "PORT", value: "3000" },
        ]
        const ports: Port[] = [
          { name: "http", containerPort: 3000, protocol: "TCP" },
          { name: "metrics", containerPort: 9090, protocol: "TCP" },
        ]
        const resources: ResourceRequirements = {
          requests: { cpu: "200m", memory: "256Mi" },
          limits: { cpu: "1000m", memory: "1Gi" },
        }
        const tolerations: Toleration[] = [
          {
            key: "dedicated",
            operator: "Equal",
            value: "web",
            effect: "NoSchedule",
            tolerationSeconds: 300,
          },
        ]
        const affinity = {
          nodeAffinity: {
            requiredDuringSchedulingIgnoredDuringExecution: {
              nodeSelectorTerms: [],
            },
          },
        }

        const builder = new DeploymentBuilder("app", "ns")
          .setReplicas(3)
          .setEnv(envVars)
          .setPorts(ports)
          .setResources(resources)
          .setLabels({ tier: "backend", version: "v2" })
          .setNodeSelector({ disktype: "ssd" })
          .setTolerations(tolerations)
          .setAffinity(affinity)
          .setServiceAccountName("custom-sa")

        const result = builder.build()
        const k8s = result.content as K8sDeploymentManifest

        expect(k8s.spec.replicas).toBe(3)
        expect(k8s.metadata.labels).toEqual({
          app: "app",
          tier: "backend",
          version: "v2",
        })
        expect(k8s.spec.selector.matchLabels).toEqual({
          app: "app",
          tier: "backend",
          version: "v2",
        })
        expect(k8s.spec.template.spec.nodeSelector).toEqual({ disktype: "ssd" })
        expect(k8s.spec.template.spec.tolerations).toEqual(tolerations)
        expect(k8s.spec.template.spec.affinity).toEqual(affinity)
        expect(k8s.spec.template.spec.serviceAccountName).toBe("custom-sa")

        const container = k8s.spec.template.spec.containers[0]
        expect(container.env).toEqual(envVars)
        expect(container.ports).toEqual(ports)
        expect(container.resources).toEqual(resources)

        const helm = result.helm.deployment
        expect(helm.replicaCount).toBe(3)
        expect(helm.env).toEqual(envVars)
        expect(helm.ports).toEqual(ports)
        expect(helm.resources).toEqual({
          requests: { cpu: "200m", memory: "256Mi" },
          limits: { cpu: "1000m", memory: "1Gi" },
        })
        expect(helm.labels).toEqual({
          app: "app",
          tier: "backend",
          version: "v2",
        })
        expect(helm.nodeSelector).toEqual({ disktype: "ssd" })
        expect(helm.tolerations).toEqual(tolerations)
        expect(helm.affinity).toEqual(affinity)
        expect(helm.serviceAccount).toEqual({ name: "custom-sa" })
      })

      it("sets probes, securityContext, podSecurityContext, and HPA", () => {
        const liveness: Probe = {
          httpGet: { path: "/healthz", port: 8080 },
          initialDelaySeconds: 10,
          periodSeconds: 15,
          timeoutSeconds: 5,
          failureThreshold: 3,
        }
        const readiness: Probe = {
          tcpSocket: { port: 8080 },
          initialDelaySeconds: 5,
          periodSeconds: 10,
        }
        const startup: Probe = {
          exec: { command: ["cat", "/tmp/ready"] },
          failureThreshold: 30,
          periodSeconds: 2,
        }
        const securityContext = {
          readOnlyRootFilesystem: true,
          runAsNonRoot: true,
        }
        const podSecurityContext = {
          runAsUser: 1000,
          fsGroup: 2000,
        }

        const builder = new DeploymentBuilder("secure-app", "secure-ns")
          .setLivenessProbe(liveness)
          .setReadinessProbe(readiness)
          .setStartupProbe(startup)
          .setSecurityContext(securityContext)
          .setPodSecurityContext(podSecurityContext)
          .setHPA(2, 10, [{ type: "Resource", resource: { name: "cpu" } }])

        const result = builder.build()
        const k8s = result.content as K8sDeploymentManifest
        const container = k8s.spec.template.spec.containers[0]

        expect(container.livenessProbe).toEqual(liveness)
        expect(container.readinessProbe).toEqual(readiness)
        expect(container.startupProbe).toEqual(startup)
        expect(container.securityContext).toEqual(securityContext)
        expect(k8s.spec.template.spec.securityContext).toEqual(
          podSecurityContext
        )

        const helm = result.helm.deployment
        expect(helm.probes.liveness).toEqual(liveness)
        expect(helm.probes.readiness).toEqual(readiness)
        expect(helm.probes.startup).toEqual(startup)
        expect(helm.securityContext).toEqual(securityContext)
        expect(helm.podSecurityContext).toEqual(podSecurityContext)
      })
    })

    describe("environment variables and valueFrom sources", () => {
      it("adds literal env vars and valueFrom configMap & secret refs", () => {
        const builder = new DeploymentBuilder("worker", "default")
          .addEnvVar("APP_NAME", "worker-1")
          .addEnvFromConfigMap("DATABASE_HOST", "db-config", "host")
          .addEnvFromSecret("DATABASE_PASSWORD", "db-secret", "password")

        const result = builder.build()
        const expectedEnv = [
          { name: "APP_NAME", value: "worker-1" },
          {
            name: "DATABASE_HOST",
            valueFrom: { configMapKeyRef: { name: "db-config", key: "host" } },
          },
          {
            name: "DATABASE_PASSWORD",
            valueFrom: { secretKeyRef: { name: "db-secret", key: "password" } },
          },
        ]

        const k8s = result.content as K8sDeploymentManifest
        expect(k8s.spec.template.spec.containers[0].env).toEqual(expectedEnv)
        expect(result.helm.deployment.env).toEqual(expectedEnv)
      })
    })

    describe("volumes and mount helpers", () => {
      it("supports addVolume directly", () => {
        const customVolume = { name: "custom-vol", emptyDir: {} }
        const customMount: VolumeMount = {
          name: "custom-vol",
          mountPath: "/custom",
          readOnly: true,
          subPath: "sub",
        }

        const builder = new DeploymentBuilder("vol-app", "default").addVolume(
          customVolume,
          customMount
        )

        const result = builder.build()
        const k8s = result.content as K8sDeploymentManifest
        expect(k8s.spec.template.spec.volumes).toEqual([customVolume])
        expect(k8s.spec.template.spec.containers[0].volumeMounts).toEqual([
          customMount,
        ])
        expect(result.helm.deployment.volumes).toEqual([customVolume])
        expect(result.helm.deployment.volumeMounts).toEqual([customMount])
      })

      it("adds PVC mounts with default and explicit readOnly", () => {
        const builder = new DeploymentBuilder("pvc-app", "default")
          .addPVC("data-pvc", "/var/data")
          .addPVC("cache-pvc", "/var/cache", true)

        const result = builder.build()
        const k8s = result.content as K8sDeploymentManifest
        expect(k8s.spec.template.spec.volumes).toEqual([
          {
            name: "data-pvc",
            persistentVolumeClaim: { claimName: "data-pvc" },
          },
          {
            name: "cache-pvc",
            persistentVolumeClaim: { claimName: "cache-pvc" },
          },
        ])
        expect(k8s.spec.template.spec.containers[0].volumeMounts).toEqual([
          { name: "data-pvc", mountPath: "/var/data", readOnly: false },
          { name: "cache-pvc", mountPath: "/var/cache", readOnly: true },
        ])
      })

      it("adds ConfigMap mounts with and without explicit volumeName and items", () => {
        const builder = new DeploymentBuilder("cm-app", "default")
          .addConfigMapMount("nginx-conf", "/etc/nginx/nginx.conf")
          .addConfigMapMount(
            "app-conf",
            "/etc/app",
            "custom-cm-vol",
            [{ key: "config.json", path: "config.json" }],
            0o755
          )

        const result = builder.build()
        const k8s = result.content as K8sDeploymentManifest
        expect(k8s.spec.template.spec.volumes).toEqual([
          {
            name: "nginx-conf",
            configMap: { name: "nginx-conf", items: [], defaultMode: 0o644 },
          },
          {
            name: "custom-cm-vol",
            configMap: {
              name: "app-conf",
              items: [{ key: "config.json", path: "config.json" }],
              defaultMode: 0o755,
            },
          },
        ])
        expect(k8s.spec.template.spec.containers[0].volumeMounts).toEqual([
          { name: "nginx-conf", mountPath: "/etc/nginx/nginx.conf" },
          { name: "custom-cm-vol", mountPath: "/etc/app" },
        ])
      })

      it("adds Secret mounts with and without explicit volumeName and items", () => {
        const builder = new DeploymentBuilder("sec-app", "default")
          .addSecretMount("tls-cert", "/etc/ssl/certs")
          .addSecretMount(
            "auth-secret",
            "/etc/secrets",
            "custom-sec-vol",
            [{ key: "token", path: "token.txt" }],
            0o400
          )

        const result = builder.build()
        const k8s = result.content as K8sDeploymentManifest
        expect(k8s.spec.template.spec.volumes).toEqual([
          {
            name: "tls-cert",
            secret: { secretName: "tls-cert", items: [], defaultMode: 0o644 },
          },
          {
            name: "custom-sec-vol",
            secret: {
              secretName: "auth-secret",
              items: [{ key: "token", path: "token.txt" }],
              defaultMode: 0o400,
            },
          },
        ])
        expect(k8s.spec.template.spec.containers[0].volumeMounts).toEqual([
          { name: "tls-cert", mountPath: "/etc/ssl/certs" },
          { name: "custom-sec-vol", mountPath: "/etc/secrets" },
        ])
      })

      it("adds EmptyDir mounts with and without sizeLimit and custom medium", () => {
        const builder = new DeploymentBuilder("emptydir-app", "default")
          .addEmptyDirMount("scratch", "/tmp")
          .addEmptyDirMount("ram-disk", "/cache", "256Mi", "Memory")

        const result = builder.build()
        const k8s = result.content as K8sDeploymentManifest
        expect(k8s.spec.template.spec.volumes).toEqual([
          { name: "scratch", emptyDir: { medium: "" } },
          {
            name: "ram-disk",
            emptyDir: { sizeLimit: "256Mi", medium: "Memory" },
          },
        ])
        expect(k8s.spec.template.spec.containers[0].volumeMounts).toEqual([
          { name: "scratch", mountPath: "/tmp" },
          { name: "ram-disk", mountPath: "/cache" },
        ])
      })

      it("adds HostPath mounts with default and custom options", () => {
        const builder = new DeploymentBuilder("hostpath-app", "default")
          .addHostPathMount(
            "docker-sock",
            "/var/run/docker.sock",
            "/docker.sock"
          )
          .addHostPathMount("host-logs", "/var/log", "/logs", "Directory", true)

        const result = builder.build()
        const k8s = result.content as K8sDeploymentManifest
        expect(k8s.spec.template.spec.volumes).toEqual([
          {
            name: "docker-sock",
            hostPath: {
              path: "/var/run/docker.sock",
              type: "DirectoryOrCreate",
            },
          },
          {
            name: "host-logs",
            hostPath: { path: "/var/log", type: "Directory" },
          },
        ])
        expect(k8s.spec.template.spec.containers[0].volumeMounts).toEqual([
          {
            name: "docker-sock",
            mountPath: "/docker.sock",
            readOnly: false,
          },
          { name: "host-logs", mountPath: "/logs", readOnly: true },
        ])
      })
    })

    describe("extra containers", () => {
      it("adds sidecar or extra containers to podSpec", () => {
        const sidecar = {
          name: "log-forwarder",
          image: "fluent/fluent-bit:latest",
          resources: { limits: { cpu: "50m", memory: "64Mi" } },
        }

        const builder = new DeploymentBuilder(
          "main-app",
          "default"
        ).addContainer(sidecar)

        const result = builder.build()
        const k8s = result.content as K8sDeploymentManifest
        expect(k8s.spec.template.spec.containers).toHaveLength(2)
        expect(k8s.spec.template.spec.containers[1]).toEqual(
          sidecar as K8sContainer
        )
      })
    })

    describe("buildApplicationHelmValues", () => {
      it("builds minimal ApplicationHelmValues with default values", () => {
        const builder = new DeploymentBuilder("unused", "unused")
        const appValues = builder.buildApplicationHelmValues({
          namespace: "test-ns",
          slug: "test-slug",
          env: "production",
          containerName: "web",
          image: "registry.example.com/web",
          tag: "v1.0.0",
          replicas: 2,
        })

        expect(appValues.global).toEqual({
          namespace: "test-ns",
          labels: {
            "app.kubernetes.io/name": "test-slug",
            "app.kubernetes.io/instance": "test-slug",
            "app.kubernetes.io/environment": "production",
          },
          annotations: {},
        })
        expect(appValues.chart).toEqual({
          name: "app-deployment",
          version: "0.1.0",
        })
        expect(appValues.applications).toHaveLength(1)

        const app = appValues.applications[0]
        expect(app.name).toBe("web")
        expect(app.image).toEqual({
          repository: "registry.example.com/web",
          tag: "v1.0.0",
          pullPolicy: "IfNotPresent",
        })
        expect(app.type).toBe("deployment")
        expect(app.replicaCount).toBe(2)
        expect(app.env).toBeUndefined()
        expect(app.service).toBeUndefined()
        expect(app.resources).toBeUndefined()
        expect(appValues.ingress).toBeUndefined()
        expect(appValues.storage).toBeUndefined()
      })

      it("handles image parsing with tag embedded in image string", () => {
        const builder = new DeploymentBuilder("unused", "unused")
        const appValues = builder.buildApplicationHelmValues({
          namespace: "ns",
          slug: "slug",
          env: "staging",
          containerName: "web",
          image: "redis:7.2-alpine",
          tag: "",
          replicas: 1,
        })

        expect(appValues.applications[0].image).toEqual({
          repository: "redis",
          tag: "7.2-alpine",
          pullPolicy: "IfNotPresent",
        })
      })

      it("handles image parsing when tag is missing completely", () => {
        const builder = new DeploymentBuilder("unused", "unused")
        const appValues = builder.buildApplicationHelmValues({
          namespace: "ns",
          slug: "slug",
          env: "staging",
          containerName: "web",
          image: "redis",
          tag: "",
          replicas: 1,
        })

        expect(appValues.applications[0].image).toEqual({
          repository: "redis",
          tag: "latest",
          pullPolicy: "IfNotPresent",
        })
      })

      it("builds comprehensive ApplicationHelmValues with all features enabled", () => {
        const builder = new DeploymentBuilder("unused", "unused")
        const envVars = [{ name: "KEY", value: "VAL" }]
        const ports: Port[] = [
          { containerPort: 8080 }, // default name/protocol
          { name: "metrics", containerPort: 9090, protocol: "UDP" },
        ]
        const startupProbe: Probe = {
          httpGet: { path: "/health/startup", port: 8080 },
        }
        const readinessProbe: Probe = {
          httpGet: { path: "/health/ready", port: 8080 },
        }
        const nodeSelector = { "node-role": "worker" }
        const tolerations: Toleration[] = [
          { key: "dedicated", effect: "NoSchedule" },
        ]
        const affinity = { podAntiAffinity: {} }

        const appValues = builder.buildApplicationHelmValues({
          namespace: "full-ns",
          slug: "full-app",
          env: "production",
          containerName: "backend",
          image: "repo/app",
          tag: "1.2.3",
          replicas: 3,
          envVars,
          ports,
          cpuRequest: "250m",
          memoryRequestMb: 256,
          cpuLimit: "1000m",
          memoryLimitMb: 1024,
          startupProbe,
          readinessProbe,
          nodeSelector,
          tolerations,
          affinity,
          serviceAccountName: "backend-sa",
          domainName: "app.example.com",
          certIssuer: "letsencrypt-staging",
          requiresPersistentStorage: true,
          storageClass: "fast-nvme",
          storageSizeGb: 20,
          isHpaSupported: true,
          autoscaling: {
            minReplicas: 2,
            maxReplicas: 10,
            cpuThreshold: 75,
            memoryThreshold: 85,
            mode: "all",
          },
        })

        const app = appValues.applications[0]
        expect(app.env).toEqual(envVars)
        expect(app.service).toEqual({
          enabled: true,
          type: "ClusterIP",
          ports: [
            {
              name: "http",
              port: 8080,
              targetPort: 8080,
              protocol: "TCP",
            },
            {
              name: "metrics",
              port: 9090,
              targetPort: 9090,
              protocol: "UDP",
            },
          ],
        })
        expect(app.resources).toEqual({
          requests: { cpu: "250m", memory: "256Mi" },
          limits: { cpu: "1000m", memory: "1024Mi" },
        })
        expect(app.startupProbe).toEqual(startupProbe)
        expect(app.readinessProbe).toEqual(readinessProbe)
        expect(app.nodeSelector).toEqual(nodeSelector)
        expect(app.tolerations).toEqual(tolerations)
        expect(app.affinity).toEqual(affinity)
        expect(app.serviceAccountName).toBe("backend-sa")
        expect(app.autoscaling).toEqual({
          enabled: true,
          minReplicas: 2,
          maxReplicas: 10,
          targetCPUUtilizationPercentage: 75,
          targetMemoryUtilizationPercentage: 85,
        })

        // Ingress configuration
        expect(appValues.ingress).toEqual({
          enabled: true,
          className: "haproxy",
          annotations: {
            "cert-manager.io/cluster-issuer": "letsencrypt-staging",
          },
          hosts: [
            {
              host: "app.example.com",
              paths: [{ path: "/", pathType: "Prefix" }],
            },
          ],
          tls: [
            {
              secretName: "full-ns-tls-secret",
              hosts: ["app.example.com"],
            },
          ],
        })

        // Storage configuration
        expect(appValues.storage).toEqual({
          persistence: {
            enabled: true,
            storageClass: "fast-nvme",
            accessMode: "ReadWriteOnce",
            size: "20Gi",
            mountPath: "/data",
          },
        })
      })

      it("handles default fallbacks for domain cert issuer, storage, and autoscaling memory mode", () => {
        const builder = new DeploymentBuilder("unused", "unused")
        const appValues = builder.buildApplicationHelmValues({
          namespace: "default-ns",
          slug: "default-app",
          env: "dev",
          containerName: "web",
          image: "app:latest",
          tag: "latest",
          replicas: 1,
          domainName: "dev.example.com",
          requiresPersistentStorage: true,
          isHpaSupported: true,
          autoscaling: {
            minReplicas: 1,
            maxReplicas: 5,
            cpuThreshold: 80,
            mode: "memory",
          },
        })

        expect(
          appValues.ingress?.annotations["cert-manager.io/cluster-issuer"]
        ).toBe("letsencrypt-prod")

        expect(appValues.storage?.persistence).toEqual({
          enabled: true,
          storageClass: "standard",
          accessMode: "ReadWriteOnce",
          size: "1Gi",
          mountPath: "/data",
        })

        expect(appValues.applications[0].autoscaling).toEqual({
          enabled: true,
          minReplicas: 1,
          maxReplicas: 5,
          targetCPUUtilizationPercentage: 80,
          targetMemoryUtilizationPercentage: 80, // fallback default 80
        })
      })

      it("omits memory utilization target when autoscaling mode is cpu only", () => {
        const builder = new DeploymentBuilder("unused", "unused")
        const appValues = builder.buildApplicationHelmValues({
          namespace: "ns",
          slug: "app",
          env: "prod",
          containerName: "web",
          image: "app:1.0",
          tag: "1.0",
          replicas: 1,
          isHpaSupported: true,
          autoscaling: {
            minReplicas: 1,
            maxReplicas: 5,
            cpuThreshold: 60,
            mode: "cpu",
          },
        })

        expect(appValues.applications[0].autoscaling).toEqual({
          enabled: true,
          minReplicas: 1,
          maxReplicas: 5,
          targetCPUUtilizationPercentage: 60,
        })
      })

      it("ignores autoscaling if isHpaSupported is false", () => {
        const builder = new DeploymentBuilder("unused", "unused")
        const appValues = builder.buildApplicationHelmValues({
          namespace: "ns",
          slug: "app",
          env: "prod",
          containerName: "web",
          image: "app:1.0",
          tag: "1.0",
          replicas: 1,
          isHpaSupported: false,
          autoscaling: {
            minReplicas: 1,
            maxReplicas: 5,
            cpuThreshold: 60,
            mode: "cpu",
          },
        })

        expect(appValues.applications[0].autoscaling).toBeUndefined()
      })
    })
  })

  describe("CLI Command Generators", () => {
    const mockValues: ApplicationHelmValues = {
      global: {
        namespace: "test-ns",
        labels: { app: "my-app" },
        annotations: {},
      },
      chart: { name: "app-deployment", version: "0.1.0" },
      applications: [
        {
          name: "web",
          image: {
            repository: "ghcr.io/org/repo",
            tag: "v1.0.0",
            pullPolicy: "IfNotPresent",
          },
          type: "deployment",
          replicaCount: 2,
          service: {
            enabled: true,
            type: "NodePort",
            port: 80,
            targetPort: 8080,
          },
        },
      ],
    }

    describe("generateHelmInstallCommand", () => {
      it("returns fallback command if applications array is empty", () => {
        const emptyValues: ApplicationHelmValues = {
          ...mockValues,
          applications: [],
        }
        const cmd = generateHelmInstallCommand(
          "my-release",
          "my-repo/my-chart",
          emptyValues
        )
        expect(cmd).toBe("helm install my-release my-repo/my-chart")
      })

      it("generates correct install command with repository, tag, replicas, and service ports", () => {
        const cmd = generateHelmInstallCommand(
          "prod-app",
          "charts/app",
          mockValues
        )
        expect(cmd).toBe(
          "helm install prod-app charts/app --set image.repository=ghcr.io/org/repo --set image.tag=v1.0.0 --set replicaCount=2 --set service.type=NodePort --set service.port=80 --set service.targetPort=8080"
        )
      })

      it("uses service.port as targetPort fallback when targetPort is not defined", () => {
        const valuesWithoutTargetPort: ApplicationHelmValues = {
          ...mockValues,
          applications: [
            {
              ...mockValues.applications[0],
              service: {
                enabled: true,
                type: "ClusterIP",
                port: 3000,
              },
            },
          ],
        }
        const cmd = generateHelmInstallCommand(
          "test-release",
          "charts/app",
          valuesWithoutTargetPort
        )
        expect(cmd).toBe(
          "helm install test-release charts/app --set image.repository=ghcr.io/org/repo --set image.tag=v1.0.0 --set replicaCount=2 --set service.type=ClusterIP --set service.port=3000 --set service.targetPort=3000"
        )
      })

      it("omits service args if service is undefined", () => {
        const valuesNoService: ApplicationHelmValues = {
          ...mockValues,
          applications: [
            {
              name: "worker",
              image: {
                repository: "worker-repo",
                tag: "latest",
                pullPolicy: "IfNotPresent",
              },
              type: "deployment",
              replicaCount: 1,
            },
          ],
        }
        const cmd = generateHelmInstallCommand(
          "worker-release",
          "charts/worker",
          valuesNoService
        )
        expect(cmd).toBe(
          "helm install worker-release charts/worker --set image.repository=worker-repo --set image.tag=latest --set replicaCount=1"
        )
      })
    })

    describe("generateHelmUpgradeCommand", () => {
      it("returns fallback command if applications array is empty", () => {
        const emptyValues: ApplicationHelmValues = {
          ...mockValues,
          applications: [],
        }
        const cmd = generateHelmUpgradeCommand(
          "my-release",
          "my-repo/my-chart",
          emptyValues
        )
        expect(cmd).toBe("helm upgrade my-release my-repo/my-chart")
      })

      it("generates correct upgrade command with full service properties", () => {
        const cmd = generateHelmUpgradeCommand(
          "prod-app",
          "charts/app",
          mockValues
        )
        expect(cmd).toBe(
          "helm upgrade prod-app charts/app --set image.repository=ghcr.io/org/repo --set image.tag=v1.0.0 --set replicaCount=2 --set service.type=NodePort --set service.port=80 --set service.targetPort=8080"
        )
      })

      it("uses service.port as targetPort fallback when targetPort is not defined", () => {
        const valuesWithoutTargetPort: ApplicationHelmValues = {
          ...mockValues,
          applications: [
            {
              ...mockValues.applications[0],
              service: {
                enabled: true,
                type: "ClusterIP",
                port: 5000,
              },
            },
          ],
        }
        const cmd = generateHelmUpgradeCommand(
          "test-release",
          "charts/app",
          valuesWithoutTargetPort
        )
        expect(cmd).toBe(
          "helm upgrade test-release charts/app --set image.repository=ghcr.io/org/repo --set image.tag=v1.0.0 --set replicaCount=2 --set service.type=ClusterIP --set service.port=5000 --set service.targetPort=5000"
        )
      })
    })
  })

  describe("YAML Serialization", () => {
    describe("helmValuesToYaml", () => {
      it("serializes ApplicationHelmValues to valid YAML string", () => {
        const values: ApplicationHelmValues = {
          global: {
            namespace: "prod",
            labels: { "app.kubernetes.io/name": "test-yaml" },
            annotations: { "deployed-by": "ci" },
          },
          chart: { name: "app-deployment", version: "0.1.0" },
          applications: [
            {
              name: "web-server",
              image: {
                repository: "nginx",
                tag: "alpine",
                pullPolicy: "IfNotPresent",
              },
              type: "deployment",
              replicaCount: 2,
              env: [{ name: "ENV", value: "production" }],
            },
          ],
        }

        const yamlString = helmValuesToYaml(values)
        expect(typeof yamlString).toBe("string")
        expect(yamlString).toContain("namespace: prod")
        expect(yamlString).toContain("repository: nginx")

        const parsed = jsYaml.load(yamlString) as ApplicationHelmValues
        expect(parsed).toEqual(values)
      })
    })
  })
})
