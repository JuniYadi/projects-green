import { describe, it, expect } from "bun:test"
import {
  buildKubeExecUrl,
  decodeKubeFrame,
  encodeKubeFrame,
  encodeResizeFrame,
  KUBE_EXEC_CHANNELS,
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
  })

  it("encodes terminal resize frame with channel 4", () => {
    const resizeFrame = encodeResizeFrame(120, 35)
    expect(resizeFrame[0]).toBe(KUBE_EXEC_CHANNELS.RESIZE)

    const decoded = decodeKubeFrame(resizeFrame)
    expect(decoded.channel).toBe(4)
    const json = JSON.parse(decoded.data)
    expect(json).toEqual({ Width: 120, Height: 35 })
  })
})
