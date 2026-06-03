import { describe, it, expect } from "bun:test"
import { VolumeBuilder, VolumeMountBuilder } from "./volume.builder"

describe("VolumeBuilder", () => {
  it("generates ConfigMap volume", () => {
    const volume = new VolumeBuilder()
      .configMap("my-config", "/etc/config")
      .build()

    expect(volume.name).toBe("my-config")
    expect(volume.configMap).toBeDefined()
    expect(volume.configMap!.name).toBe("my-config")
  })

  it("generates Secret volume", () => {
    const volume = new VolumeBuilder()
      .secret("my-secret", "/etc/secrets")
      .build()

    expect(volume.name).toBe("my-secret")
    expect(volume.secret).toBeDefined()
    expect(volume.secret!.secretName).toBe("my-secret")
  })

  it("generates PVC volume", () => {
    const volume = new VolumeBuilder()
      .pvc("my-pvc", "/data")
      .withReadOnly(true)
      .build()

    expect(volume.name).toBe("my-pvc")
    expect(volume.persistentVolumeClaim).toBeDefined()
    expect(volume.persistentVolumeClaim!.claimName).toBe("my-pvc")
    expect(volume.persistentVolumeClaim!.readOnly).toBe(true)
  })
})

describe("VolumeMountBuilder", () => {
  it("generates volume mounts", () => {
    const mounts = new VolumeMountBuilder()
      .add("config-volume", "/etc/config", false)
      .add("secret-volume", "/etc/secrets", true)
      .add("pvc-volume", "/data", false)
      .build()

    expect(mounts).toEqual([
      { name: "config-volume", mountPath: "/etc/config", readOnly: false },
      { name: "secret-volume", mountPath: "/etc/secrets", readOnly: true },
      { name: "pvc-volume", mountPath: "/data", readOnly: false },
    ])
  })
})
