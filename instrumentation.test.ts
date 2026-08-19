import { afterEach, expect, mock, test } from "bun:test"

const installNextServerActionDiagnostics = mock()

mock.module("@/lib/next-server-action-logging", () => ({
  installNextServerActionDiagnostics,
}))

const { register } = await import("@/instrumentation")

const originalRuntime = process.env.NEXT_RUNTIME

afterEach(() => {
  installNextServerActionDiagnostics.mockClear()
  if (originalRuntime === undefined) {
    delete process.env.NEXT_RUNTIME
  } else {
    process.env.NEXT_RUNTIME = originalRuntime
  }
})

test("registers the diagnostic wrapper for the Node.js web runtime", async () => {
  process.env.NEXT_RUNTIME = "nodejs"

  await register()

  expect(installNextServerActionDiagnostics).toHaveBeenCalledTimes(1)
})

test("does not install the Node.js wrapper in the Edge runtime", async () => {
  process.env.NEXT_RUNTIME = "edge"

  await register()

  expect(installNextServerActionDiagnostics).not.toHaveBeenCalled()
})
