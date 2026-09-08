import { describe, it, expect } from "bun:test"
import {
  buildKubeExecUrl,
  decodeKubeFrame,
  encodeKubeFrame,
  encodeResizeFrame,
  KUBE_EXEC_CHANNELS,
  resolveStackExecCredentials,
} from "./pod-exec.service"

describe("pod-exec.service", () => {
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
})
