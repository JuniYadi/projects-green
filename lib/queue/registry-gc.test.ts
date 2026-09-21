import { describe, expect, it } from "bun:test"
import { RegistryGcJob } from "./registry-gc"

describe("RegistryGcJob", () => {
  it("defines standard queue name and job name", () => {
    expect(RegistryGcJob.queue).toBe("registry-gc")
    expect(RegistryGcJob.jobName).toBe("RegistryGcJob")
  })

  it("defines worker concurrency of 1 for safe registry GC", () => {
    expect(RegistryGcJob.workerConcurrency).toBe(1)
  })
})
