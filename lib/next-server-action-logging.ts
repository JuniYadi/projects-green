import { type JsonLogWriter, writeJsonLogLine } from "@/lib/server-logging"

export const NEXT_SERVER_ACTION_MISMATCH_MESSAGE =
  "A Server Action request did not match this deployment."

const serverActionMismatchPattern =
  /^Failed to find Server Action(?: "[^"\r\n]*")?\. This request might be from an older or newer deployment\.\nRead more: https:\/\/nextjs\.org\/docs\/messages\/failed-to-find-server-action$/

type ConsoleWarning = (...args: unknown[]) => void

export type NextServerActionConsole = {
  warn: ConsoleWarning
}

export type InstallNextServerActionDiagnosticsOptions = {
  consoleObject?: NextServerActionConsole
  writer?: JsonLogWriter
}

type Installation = {
  restore: () => void
  wrappedWarn: ConsoleWarning
}

const installations = new WeakMap<object, Installation>()

export const isNextServerActionDeploymentMismatch = (
  value: unknown
): boolean => {
  if (!(value instanceof Error)) {
    return false
  }

  try {
    return serverActionMismatchPattern.test(value.message)
  } catch {
    return false
  }
}

export const installNextServerActionDiagnostics = ({
  consoleObject = console,
  writer = writeJsonLogLine,
}: InstallNextServerActionDiagnosticsOptions = {}): (() => void) => {
  const existing = installations.get(consoleObject)
  if (existing) {
    return existing.restore
  }

  const originalWarn = consoleObject.warn
  const wrappedWarn: ConsoleWarning = (...args) => {
    if (args.length === 1 && isNextServerActionDeploymentMismatch(args[0])) {
      try {
        writer({
          timestamp: new Date().toISOString(),
          level: "error",
          event: "next.server_action.mismatch",
          service: "web",
          errorCode: "SERVER_ACTION_DEPLOYMENT_MISMATCH",
          message: NEXT_SERVER_ACTION_MISMATCH_MESSAGE,
        })
      } catch {
        // Logging must not change Next.js' response path when stderr fails.
      }
      return
    }

    Reflect.apply(originalWarn, consoleObject, args)
  }

  const restore = () => {
    const current = installations.get(consoleObject)
    if (current?.wrappedWarn !== wrappedWarn) {
      return
    }

    consoleObject.warn = originalWarn
    installations.delete(consoleObject)
  }

  consoleObject.warn = wrappedWarn
  installations.set(consoleObject, { restore, wrappedWarn })

  return restore
}
