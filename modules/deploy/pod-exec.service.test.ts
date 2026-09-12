import { describe, it, expect, mock, beforeEach, afterEach } from "bun:test"
import {
  buildKubeExecUrl,
  decodeKubeFrame,
  encodeKubeFrame,
  encodeResizeFrame,
  KUBE_EXEC_CHANNELS,
  listStackExecTargets,
  pickExecTarget,
  resolveStackExecCredentials,
} from "./pod-exec.service"
import {
  toTerminalTargetDTO,
  type KubeExecPod,
  type TerminalTargetDTO,
} from "./terminal-target.dto"

const mockResolveClusterIntegration = mock()

mock.module("./cluster-integration.service", () => ({
  resolveClusterIntegration: mockResolveClusterIntegration,
}))

describe("pod-exec.service", () => {
  beforeEach(() => {
    mockResolveClusterIntegration.mockReset()
  })

  it("builds correct kubernetes exec URL with parameters", () => {
    const url = buildKubeExecUrl(
      "https://10.43.0.1:443",
      "app-my-stack",
      "my-pod-abc",
      "main-app",
      ["/bin/sh"]
    )

    expect(url).toContain(
      "wss://10.43.0.1:443/api/v1/namespaces/app-my-stack/pods/my-pod-abc/exec"
    )
    expect(url).toContain("stdin=true")
    expect(url).toContain("stdout=true")
    expect(url).toContain("stderr=true")
    expect(url).toContain("tty=true")
    expect(url).toContain("container=main-app")
    expect(url).toContain("command=%2Fbin%2Fsh")
  })

  it("builds URL with default command and without container", () => {
    const url = buildKubeExecUrl(
      "http://10.43.0.1:443/",
      "app-my-stack",
      "my-pod-abc"
    )
    expect(url).toContain(
      "ws://10.43.0.1:443/api/v1/namespaces/app-my-stack/pods/my-pod-abc/exec"
    )
    expect(url).toContain("command=%2Fbin%2Fsh")
    expect(url).not.toContain("container=")
  })

  it("encodes and decodes kubernetes subprotocol stream frames", () => {
    const text = "echo 'hello world'\n"
    const encoded = encodeKubeFrame(KUBE_EXEC_CHANNELS.STDIN, text)
    expect(encoded[0]).toBe(0)

    const decoded = decodeKubeFrame(encoded)
    expect(decoded.channel).toBe(0)
    expect(decoded.data).toBe(text)

    // Test with raw Uint8Array input
    const rawBytes = new TextEncoder().encode("ls -la\n")
    const encodedRaw = encodeKubeFrame(KUBE_EXEC_CHANNELS.STDIN, rawBytes)
    const decodedRaw = decodeKubeFrame(encodedRaw)
    expect(decodedRaw.data).toBe("ls -la\n")

    // Test empty buffer decode
    const emptyDecoded = decodeKubeFrame(new Uint8Array(0))
    expect(emptyDecoded.channel).toBe(0)
    expect(emptyDecoded.data).toBe("")
  })

  it("encodes terminal resize frame with channel 4", () => {
    const resizeFrame = encodeResizeFrame(120, 35)
    expect(resizeFrame[0]).toBe(KUBE_EXEC_CHANNELS.RESIZE)

    const decoded = decodeKubeFrame(resizeFrame)
    expect(decoded.channel).toBe(4)
    const json = JSON.parse(decoded.data) as { Width: number; Height: number }
    expect(json).toEqual({ Width: 120, Height: 35 })
  })

  it("encodes all kubernetes subprotocol channels accurately", () => {
    expect(KUBE_EXEC_CHANNELS.STDIN).toBe(0)
    expect(KUBE_EXEC_CHANNELS.STDOUT).toBe(1)
    expect(KUBE_EXEC_CHANNELS.STDERR).toBe(2)
    expect(KUBE_EXEC_CHANNELS.ERROR).toBe(3)
    expect(KUBE_EXEC_CHANNELS.RESIZE).toBe(4)
  })

  describe("resolveStackExecCredentials", () => {
    it("returns credentials directly when provided in kubeConfig", async () => {
      mockResolveClusterIntegration.mockResolvedValueOnce({
        connectionMode: "EXTERNAL",
        apiServerUrl: "https://k8s.external:6443",
        serviceAccountToken: "secret-token-xyz",
        caCertificate: "ca-cert-data",
      })

      const creds = await resolveStackExecCredentials("stk_1")
      expect(creds.url).toBe("https://k8s.external:6443")
      expect(creds.token).toBe("secret-token-xyz")
      expect(creds.caCert).toBe("ca-cert-data")
    })

    it("falls back to in-cluster host env when url is missing", async () => {
      const origHost = process.env.KUBERNETES_SERVICE_HOST
      const origPort = process.env.KUBERNETES_SERVICE_PORT
      process.env.KUBERNETES_SERVICE_HOST = "10.43.0.1"
      process.env.KUBERNETES_SERVICE_PORT = "443"

      mockResolveClusterIntegration.mockResolvedValueOnce({
        connectionMode: "INTERNAL",
        apiServerUrl: null,
        serviceAccountToken: "test-sa-token",
        caCertificate: null,
      })

      const creds = await resolveStackExecCredentials("stk_1")
      expect(creds.url).toBe("https://10.43.0.1:443")
      expect(creds.token).toBe("test-sa-token")

      process.env.KUBERNETES_SERVICE_HOST = origHost
      process.env.KUBERNETES_SERVICE_PORT = origPort
    })

    it("throws error when no token is available", async () => {
      mockResolveClusterIntegration.mockResolvedValueOnce({
        connectionMode: "EXTERNAL",
        apiServerUrl: "https://k8s.external",
        serviceAccountToken: null,
        caCertificate: null,
      })

      expect(resolveStackExecCredentials("stk_1")).rejects.toThrow(
        "No Kubernetes service account token available"
      )
    })
  })
})

const runningPod = (
  name: string,
  creationTimestamp: string,
  extra: { phase?: string; deletionTimestamp?: string } = {}
): KubeExecPod => ({
  metadata: {
    name,
    creationTimestamp,
    deletionTimestamp: extra.deletionTimestamp,
  },
  spec: { containers: [{ name: "app" }] },
  status: {
    phase: extra.phase ?? "Running",
    conditions: [{ type: "Ready", status: "True" }],
  },
})

describe("listStackExecTargets", () => {
  const originalFetch = globalThis.fetch
  const creds = { url: "https://k8s.test/", token: "tok", caCert: "ca" }

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it("lists live pods of this app by label selector, oldest first", async () => {
    const mockFetch = mock(async () =>
      Response.json({
        items: [
          runningPod("api-b", "2026-09-13T10:05:00Z"),
          runningPod("api-a", "2026-09-13T10:00:00Z"),
          runningPod("api-pending", "2026-09-13T09:00:00Z", {
            phase: "Pending",
          }),
          runningPod("api-old", "2026-09-13T08:00:00Z", {
            deletionTimestamp: "2026-09-13T10:06:00Z",
          }),
        ],
      })
    )
    globalThis.fetch = mockFetch as unknown as typeof fetch

    const targets = await listStackExecTargets({
      namespace: "app-org",
      slug: "api",
      creds,
    })

    const [url, init] = mockFetch.mock.calls[0] as unknown as [
      string,
      { headers: Record<string, string>; tls?: { ca: string[] } },
    ]
    expect(url).toBe(
      "https://k8s.test/api/v1/namespaces/app-org/pods?labelSelector=app.kubernetes.io%2Finstance%3Dapi"
    )
    expect(init.headers.Authorization).toBe("Bearer tok")
    expect(init.tls).toEqual({ ca: ["ca"] })
    expect(targets.map((t) => [t.pod, t.label])).toEqual([
      ["api-a", "Replica 1"],
      ["api-b", "Replica 2"],
    ])
  })

  it("throws when the pod list request fails", async () => {
    globalThis.fetch = mock(
      async () => new Response("forbidden", { status: 403 })
    ) as unknown as typeof fetch

    expect(
      listStackExecTargets({ namespace: "app-org", slug: "api", creds })
    ).rejects.toThrow("HTTP 403")
  })
})

describe("pickExecTarget", () => {
  const target = (
    pod: string,
    ready: boolean,
    containers = ["app"]
  ): TerminalTargetDTO => ({
    pod,
    label: pod,
    ready,
    containers,
    defaultContainer: containers[0] ?? "",
  })
  const targets = [
    target("api-a", false),
    target("api-b", true, ["app", "worker"]),
  ]

  it("defaults to the first ready replica and its default container", () => {
    expect(pickExecTarget(targets)).toEqual({ pod: "api-b", container: "app" })
  })

  it("accepts a pod and container from the list", () => {
    expect(pickExecTarget(targets, "api-b", "worker")).toEqual({
      pod: "api-b",
      container: "worker",
    })
  })

  it("rejects a pod outside the app", () => {
    expect(pickExecTarget(targets, "billing-x")).toEqual({
      error: "Pod is not part of this app",
    })
  })

  it("rejects a container outside the pod", () => {
    expect(pickExecTarget(targets, "api-a", "worker")).toEqual({
      error: "Container is not part of this pod",
    })
  })

  it("uses the default-container annotation when present", () => {
    const pod: KubeExecPod = {
      metadata: {
        name: "api-a",
        annotations: { "kubectl.kubernetes.io/default-container": "app" },
      },
      spec: { containers: [{ name: "sidecar" }, { name: "app" }] },
    }

    expect(toTerminalTargetDTO(pod, 0).defaultContainer).toBe("app")
    expect(
      toTerminalTargetDTO({ ...pod, metadata: { name: "api-a" } }, 0)
        .defaultContainer
    ).toBe("sidecar")
  })
})
