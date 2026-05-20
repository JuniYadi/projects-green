import {
  createEnvironmentVariable,
  deleteEnvironmentVariable,
  importEnvironmentVariables,
  listEnvironmentVariables,
  updateEnvironmentVariable,
} from "@/modules/deploy/api/environment-variables.stub"
import type {
  EnvVariableRecord,
  EnvVariablesMutationResponse,
} from "@/modules/deploy/api/environment-variables.contract"

type MutateCreateInput = {
  environmentId: string
  key: string
  value: string
  type?: "plain" | "secret"
  scope?: "all" | "build" | "runtime"
}

type MutateUpdateInput = {
  environmentId: string
  variableId: string
  key: string
  value?: string
  type?: "plain" | "secret"
  scope?: "all" | "build" | "runtime"
}

type ImportInput = {
  environmentId: string
  raw: string
  scope?: "all" | "build" | "runtime"
}

const parseJsonSafely = async (response: Response) => {
  try {
    return await response.json()
  } catch {
    return null
  }
}

const shouldUseHttp = process.env.NODE_ENV !== "test"

const fetchList = async (
  environmentId: string
): Promise<EnvVariableRecord[] | null> => {
  if (!shouldUseHttp) {
    return null
  }

  try {
    const response = await fetch(`/api/deploy/environments/${environmentId}/variables`)
    if (!response.ok) {
      return null
    }

    const payload = (await parseJsonSafely(response)) as
      | { ok?: boolean; items?: EnvVariableRecord[] }
      | null

    if (!payload?.ok || !Array.isArray(payload.items)) {
      return null
    }

    return payload.items
  } catch {
    return null
  }
}

const fetchMutation = async (
  path: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: Record<string, unknown>
): Promise<EnvVariablesMutationResponse | null> => {
  if (!shouldUseHttp) {
    return null
  }

  try {
    const response = await fetch(path, {
      method,
      headers: {
        "content-type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    const payload = (await parseJsonSafely(response)) as
      | EnvVariablesMutationResponse
      | null

    if (!payload || typeof payload !== "object" || !("ok" in payload)) {
      return null
    }

    return payload
  } catch {
    return null
  }
}

export const createEnvironmentVariablesClient = () => {
  return {
    async list(environmentId: string): Promise<EnvVariableRecord[]> {
      const fromApi = await fetchList(environmentId)
      if (fromApi) {
        return fromApi
      }

      return listEnvironmentVariables(environmentId)
    },
    async create(input: MutateCreateInput): Promise<EnvVariablesMutationResponse> {
      const fromApi = await fetchMutation(
        `/api/deploy/environments/${input.environmentId}/variables`,
        "POST",
        input
      )

      if (fromApi) {
        return fromApi
      }

      return createEnvironmentVariable(input)
    },
    async update(input: MutateUpdateInput): Promise<EnvVariablesMutationResponse> {
      const fromApi = await fetchMutation(
        `/api/deploy/environments/${input.environmentId}/variables/${input.variableId}`,
        "PATCH",
        input
      )

      if (fromApi) {
        return fromApi
      }

      return updateEnvironmentVariable(input)
    },
    async remove(input: {
      environmentId: string
      variableId: string
    }): Promise<EnvVariablesMutationResponse> {
      const fromApi = await fetchMutation(
        `/api/deploy/environments/${input.environmentId}/variables/${input.variableId}`,
        "DELETE"
      )

      if (fromApi) {
        return fromApi
      }

      return deleteEnvironmentVariable(input)
    },
    async import(input: ImportInput): Promise<EnvVariablesMutationResponse> {
      const fromApi = await fetchMutation(
        `/api/deploy/environments/${input.environmentId}/variables/import`,
        "POST",
        input
      )

      if (fromApi) {
        return fromApi
      }

      return importEnvironmentVariables(input)
    },
  }
}
