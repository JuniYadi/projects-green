import { prisma } from "@/lib/prisma"
import type { UiDocEntry } from "@/modules/docs/docs.types"
import {
  embedDocument,
  EMBEDDING_DIMENSIONS,
} from "@/modules/docs/docs-embedding.service"

const SEARCH_TOKEN_PATTERN = /[a-z0-9]+/g
const MAX_RETRIEVAL_CANDIDATES = 100
const MAX_RETRIEVAL_RESULTS = 4

type KnowledgeDocumentRecord = {
  id: string
  organizationId: string | null
  path: string
  title: string
  purpose: string
  howTo: string[]
  notes: string[]
  searchText: string
  embedding: number[]
  updatedByWorkosUserId: string
  createdAt: Date
  updatedAt: Date
}

export type UpsertDocInput = {
  organizationId: string | null
  path: string
  title: string
  purpose: string
  howTo: string[]
  notes?: string[]
  updatedByWorkosUserId: string
}

export type KnowledgeDocMatch = {
  id: string
  organizationId: string | null
  path: string
  title: string
  purpose: string
  howTo: string[]
  notes: string[]
  updatedAt: string
  score: number
}

const buildSearchText = (input: {
  path: string
  title: string
  purpose: string
  howTo: string[]
  notes: string[]
}) =>
  [input.path, input.title, input.purpose, ...input.howTo, ...input.notes]
    .join(" ")
    .toLowerCase()

const toUiDocEntry = (doc: KnowledgeDocumentRecord): UiDocEntry => ({
  path: doc.path,
  title: doc.title,
  purpose: doc.purpose,
  howTo: doc.howTo,
  notes: doc.notes.length ? doc.notes : undefined,
  updatedAt: doc.updatedAt.toISOString().slice(0, 10),
})

const tokenize = (value: string) =>
  value.toLowerCase().match(SEARCH_TOKEN_PATTERN) ?? []

const uniqueTokens = (value: string) => Array.from(new Set(tokenize(value)))

export const normalizeDocPath = (path: string) => {
  const trimmed = path.trim()

  if (!trimmed) {
    return ""
  }

  const withoutQuery = trimmed.split("?")[0]?.split("#")[0] ?? ""
  const normalized = withoutQuery.startsWith("/")
    ? withoutQuery
    : `/${withoutQuery}`

  if (normalized.length > 1 && normalized.endsWith("/")) {
    return normalized.slice(0, -1)
  }

  return normalized
}

const findDocumentByScope = async (input: {
  organizationId: string | null
  path: string
}) => {
  const where =
    input.organizationId === null
      ? {
          organizationId: null,
          path: input.path,
        }
      : {
          organizationId: input.organizationId,
          path: input.path,
        }

  return (await prisma.knowledgeDocument.findFirst({
    where,
    orderBy: {
      updatedAt: "desc",
    },
  })) as KnowledgeDocumentRecord | null
}

export const getDocByPath = async (input: {
  path: string
  organizationId: string | null
}): Promise<UiDocEntry | null> => {
  const normalized = normalizeDocPath(input.path)

  if (!normalized) {
    return null
  }

  if (input.organizationId) {
    const organizationDoc = await findDocumentByScope({
      organizationId: input.organizationId,
      path: normalized,
    })

    if (organizationDoc) {
      return toUiDocEntry(organizationDoc)
    }
  }

  const globalDoc = await findDocumentByScope({
    organizationId: null,
    path: normalized,
  })

  if (!globalDoc) {
    return null
  }

  return toUiDocEntry(globalDoc)
}

export const upsertDocByPath = async (
  input: UpsertDocInput
): Promise<UiDocEntry> => {
  const normalizedPath = normalizeDocPath(input.path)
  const normalizedHowTo = input.howTo
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
  const normalizedNotes = (input.notes ?? [])
    .map((item) => item.trim())
    .filter((item) => item.length > 0)

  const searchText = buildSearchText({
    path: normalizedPath,
    title: input.title.trim(),
    purpose: input.purpose.trim(),
    howTo: normalizedHowTo,
    notes: normalizedNotes,
  })

  // Generate embedding for semantic search
  const embedding = await embedDocument({
    path: normalizedPath,
    title: input.title.trim(),
    purpose: input.purpose.trim(),
    howTo: normalizedHowTo,
    notes: normalizedNotes,
  })

  const existingDoc = await findDocumentByScope({
    organizationId: input.organizationId,
    path: normalizedPath,
  })

  const savedDoc = existingDoc
    ? await prisma.knowledgeDocument.update({
        where: { id: existingDoc.id },
        data: {
          title: input.title.trim(),
          purpose: input.purpose.trim(),
          howTo: normalizedHowTo,
          notes: normalizedNotes,
          searchText,
          embedding,
          updatedByWorkosUserId: input.updatedByWorkosUserId,
        },
      })
    : await prisma.knowledgeDocument.create({
        data: {
          organizationId: input.organizationId,
          path: normalizedPath,
          title: input.title.trim(),
          purpose: input.purpose.trim(),
          howTo: normalizedHowTo,
          notes: normalizedNotes,
          searchText,
          embedding,
          updatedByWorkosUserId: input.updatedByWorkosUserId,
        },
      })

  return toUiDocEntry(savedDoc as KnowledgeDocumentRecord)
}

const scoreDocument = (input: {
  doc: KnowledgeDocumentRecord
  routePath: string
  queryTokens: string[]
}) => {
  const routePath = normalizeDocPath(input.routePath)
  const routeScore =
    input.doc.path === routePath
      ? 100
      : routePath.startsWith(`${input.doc.path}/`)
        ? 60
        : 0

  const docTokens = new Set(tokenize(input.doc.searchText))
  const lexicalMatches = input.queryTokens.filter((token) =>
    docTokens.has(token)
  ).length

  const lexicalScore = lexicalMatches * 5
  const pathScore = routePath.includes(input.doc.path) ? 10 : 0

  return routeScore + lexicalScore + pathScore
}

/**
 * Cosine similarity between two vectors.
 */
const cosineSimilarity = (a: number[], b: number[]): number => {
  if (a.length !== b.length) return 0

  let dot = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB)

  return denom === 0 ? 0 : dot / denom
}

export const searchKnowledgeDocs = async (input: {
  organizationId: string | null
  routePath: string
  query: string
  limit?: number
}): Promise<KnowledgeDocMatch[]> => {
  const normalizedRoutePath = normalizeDocPath(input.routePath)
  const queryTokens = uniqueTokens(input.query)
  const where = input.organizationId
    ? {
        OR: [
          { organizationId: input.organizationId },
          { organizationId: null },
        ],
      }
    : { organizationId: null }

  const candidates = (await prisma.knowledgeDocument.findMany({
    where,
    orderBy: {
      updatedAt: "desc",
    },
    take: MAX_RETRIEVAL_CANDIDATES,
  })) as KnowledgeDocumentRecord[]

  const scored = candidates
    .map((doc) => ({
      doc,
      score: scoreDocument({
        doc,
        routePath: normalizedRoutePath,
        queryTokens,
      }),
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, input.limit ?? MAX_RETRIEVAL_RESULTS)

  return scored.map(({ doc, score }) => ({
    id: doc.id,
    organizationId: doc.organizationId,
    path: doc.path,
    title: doc.title,
    purpose: doc.purpose,
    howTo: doc.howTo,
    notes: doc.notes,
    updatedAt: doc.updatedAt.toISOString().slice(0, 10),
    score,
  }))
}

/**
 * Semantic search using cosine similarity over embedding vectors.
 * Falls back to lexical search if embedding is unavailable.
 */
export const semanticSearchKnowledgeDocs = async (input: {
  organizationId: string | null
  routePath: string
  query: string
  limit?: number
}): Promise<KnowledgeDocMatch[]> => {
  const normalizedRoutePath = normalizeDocPath(input.routePath)
  const queryTokens = uniqueTokens(input.query)
  const where = input.organizationId
    ? {
        OR: [
          { organizationId: input.organizationId },
          { organizationId: null },
        ],
      }
    : { organizationId: null }

  const candidates = (await prisma.knowledgeDocument.findMany({
    where,
    take: MAX_RETRIEVAL_CANDIDATES,
  })) as KnowledgeDocumentRecord[]

  // Compute query embedding (lexical fallback if AI_API_KEY not set)
  let queryEmbedding: number[] | null = null
  try {
    const { embedding } = await embedDocument({
      path: normalizedRoutePath,
      title: input.query,
      purpose: input.query,
      howTo: [],
      notes: [],
    })
    queryEmbedding = embedding
  } catch {
    // AI_API_KEY not configured — use lexical fallback
    queryEmbedding = null
  }

  // Score each candidate: lexical score + semantic similarity
  const scored = candidates
    .map((doc) => {
      const lexicalScore = scoreDocument({
        doc,
        routePath: normalizedRoutePath,
        queryTokens,
      })

      let semanticScore = 0
      if (
        queryEmbedding &&
        doc.embedding &&
        doc.embedding.length === EMBEDDING_DIMENSIONS
      ) {
        semanticScore = cosineSimilarity(queryEmbedding, doc.embedding)
      }

      // Weighted combined score: 40% semantic, 60% lexical
      const combinedScore = semanticScore * 0.4 + lexicalScore * 0.6

      return { doc, score: combinedScore }
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, input.limit ?? MAX_RETRIEVAL_RESULTS)

  return scored.map(({ doc, score }) => ({
    id: doc.id,
    organizationId: doc.organizationId,
    path: doc.path,
    title: doc.title,
    purpose: doc.purpose,
    howTo: doc.howTo,
    notes: doc.notes,
    updatedAt: doc.updatedAt.toISOString().slice(0, 10),
    score,
  }))
}

/**
 * Re-embed all existing documents that have no embedding.
 * Used for migration or when adding semantic search to existing data.
 */
export const backfillEmbeddings = async (batchSize = 50): Promise<{
  processed: number
  errors: string[]
}> => {
  const errors: string[] = []
  let processed = 0

  let cursor: string | undefined
  let hasMore = true

  while (hasMore) {
    const docs = (await prisma.knowledgeDocument.findMany({
      take: batchSize,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      where: {
        embedding: {
          equals: [], // Prisma ArrayNone filter
        },
      },
      orderBy: { id: "asc" },
    })) as KnowledgeDocumentRecord[]

    if (docs.length === 0) {
      hasMore = false
      break
    }

    for (const doc of docs) {
      try {
        const embedding = await embedDocument({
          path: doc.path,
          title: doc.title,
          purpose: doc.purpose,
          howTo: doc.howTo,
          notes: doc.notes,
        })

        await prisma.knowledgeDocument.update({
          where: { id: doc.id },
          data: { embedding },
        })

        processed++
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        errors.push(`[${doc.id}] ${message}`)
      }
    }

    cursor = docs[docs.length - 1]?.id
    hasMore = docs.length === batchSize
  }

  return { processed, errors }
}