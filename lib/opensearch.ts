import { Client } from "@opensearch-project/opensearch"

export interface OpenSearchConfig {
  node: string
  auth: { username: string; password: string }
}

function getRegionConfig(region?: string): OpenSearchConfig {
  const suffix = region ? `_${region.replaceAll("-", "_").toUpperCase()}` : ""
  const node = process.env[`OPENSEARCH${suffix}_URL`]
  const username = process.env[`OPENSEARCH${suffix}_USER`]
  const password = process.env[`OPENSEARCH${suffix}_PASSWORD`]

  if (!node || !username || !password) {
    throw new Error(
      `OpenSearch credentials not configured for region "${region ?? "default"}". ` +
        `Set OPENSEARCH${suffix}_URL, OPENSEARCH${suffix}_USER, OPENSEARCH${suffix}_PASSWORD.`
    )
  }

  return { node, auth: { username, password } }
}

export function createOpenSearchClient(config: OpenSearchConfig): Client {
  return new Client({ node: config.node, auth: config.auth })
}

const clients = new Map<string, Client>()

export function getOpenSearchClient(region?: string): Client {
  const key = region ?? "__default__"
  let client = clients.get(key)
  if (!client) {
    const config = getRegionConfig(region)
    client = createOpenSearchClient(config)
    clients.set(key, client)
  }
  return client
}
