export type TemplateContext = {
  variables: Record<string, unknown>
  steps: Record<string, unknown>
  session: Record<string, unknown>
}

function resolveNestedPath(
  obj: Record<string, unknown>,
  path: string
): unknown {
  const parts = path.split(".")
  let current: unknown = obj

  for (const part of parts) {
    if (
      current === null ||
      current === undefined ||
      typeof current !== "object"
    ) {
      return undefined
    }
    current = (current as Record<string, unknown>)[part]
  }

  return current
}

/**
 * Evaluates template syntax `{{path}}` against context variables, step outputs,
 * and session.
 */
export function evaluateMustacheTemplate(
  template: string,
  context: TemplateContext
): string {
  if (!template || !template.includes("{{")) {
    return template
  }

  return template.replace(
    /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g,
    (_match, path: string) => {
      const val = resolveNestedPath(context as Record<string, unknown>, path)
      if (val === undefined || val === null) {
        return ""
      }
      if (typeof val === "object") {
        return JSON.stringify(val)
      }
      return String(val)
    }
  )
}
