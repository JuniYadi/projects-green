/**
 * Knowledge Base Docs Seeder (System)
 *
 * Seeds canonical knowledge base documentation, screenshots mappings,
 * and vector embeddings for public /docs and AI help search.
 */

import { BaseSeeder, registerSeeder } from "@/lib/seeders"
import { embedDocument } from "@/modules/docs/docs-embedding.service"
import { createHash } from "node:crypto"

export interface KnowledgeDocSeed {
  path: string
  title: string
  purpose: string
  category: string
  howTo: string[]
  notes: string[]
  markdown: string
}

export const CANONICAL_DOCUMENTS: KnowledgeDocSeed[] = [
  {
    path: "/whatsapp/api-keys",
    title: "WhatsApp API Key Management & Integration Guide",
    purpose:
      "Generate, rotate, and securely use your organization's static WhatsApp API key to integrate with the WhatsApp Business Platform.",
    category: "WhatsApp",
    howTo: [
      "Navigate to Console > WhatsApp > API Key (/console/whatsapp/api-keys).",
      "Click Generate API key and copy the one-time API secret immediately.",
      "Store the secret in your password manager or backend environment vault.",
      "Authenticate requests using the Authorization: Bearer <API_KEY> header.",
    ],
    notes: [
      "The plaintext API secret is displayed only once upon creation or rotation.",
      "Each organization has at most one ACTIVE key at a time.",
      "Key rotation immediately invalidates the previous API key.",
    ],
    markdown: `
# WhatsApp API Key Management & Integration Guide

This guide explains how to generate, rotate, and securely use your organization's static WhatsApp API key to integrate with the WhatsApp Business Platform APIs.

---

## 1. Overview & Security Model

The WhatsApp API key allows backend services to authenticate API requests on behalf of your organization.

- **Zero-Trust Token Visibility**: The plaintext API secret is **displayed only once** upon creation or rotation. It is never stored in plaintext and cannot be retrieved again once dismissed.
- **Single Active Key Model**: Each organization has at most one \`ACTIVE\` key at a time.
- **Safe Metadata**: Fingerprints (\`wa_key_...\`) and lifecycle timestamps (Created, Rotated, Revoked, Last Used) can be safely shared for auditing without exposing secret material.

---

## 2. Generating Your API Key

### Step 1: Navigate to API Keys Console
Go to **Console** > **WhatsApp** > **API Key** (\`/console/whatsapp/api-keys\`).

If your organization does not yet have an active API key, the status badge will indicate **Not generated**.

![Initial Not Generated State](/kb-assets/whatsapp/api-keys/01-initial-empty-state.png)

---

### Step 2: Generate the API Key
1. Click the **"Generate API key"** button.
2. The system immediately provisions the key and presents the **One-time API secret** banner.
3. Click **"Copy secret"** to copy your secret key to your password manager or environment secrets vault.

![Key Generated with One-Time Secret](/kb-assets/whatsapp/api-keys/02-key-generated-with-secret.png)

> ⚠️ **Important:**
> Once you navigate away or refresh the page, the secret cannot be shown again. If you lose the secret, you must rotate the key.

---

## 3. Key Lifecycle Management

### Rotating an API Key
If you suspect your key has been leaked or your security policy requires periodic rotation:
1. Click **"Rotate API key"**.
2. Read the confirmation dialog: **The current key will stop working immediately**.
3. Confirm rotation to generate a new key and receive a fresh one-time secret.

![Rotate API Key Confirmation Dialog](/kb-assets/whatsapp/api-keys/03-rotate-key-dialog.png)

---

### Revoking an API Key
To immediately terminate all API access without issuing a replacement key:
1. Click **"Revoke API key"**.
2. Confirm the revocation dialog.
3. The key status switches to **Revoked**, and incoming requests using this key will receive \`401 Unauthorized\`.

![Revoke API Key Confirmation Dialog](/kb-assets/whatsapp/api-keys/04-revoke-key-dialog.png)

---

## 4. Authenticating API Requests

To authenticate requests to the WhatsApp API endpoints, provide your API key in standard \`Authorization: Bearer <API_KEY>\` header or \`x-api-key\` header.

### Example: Send WhatsApp Template Message

\`\`\`bash
curl -X POST "https://api.pfnapp.my.id/api/whatsapp/messages" \\
  -H "Authorization: Bearer pfn_wa_sec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "+6281234567890",
    "type": "template",
    "template": {
      "name": "order_notification",
      "language": {
        "code": "id"
      },
      "components": [
        {
          "type": "body",
          "parameters": [
            { "type": "text", "text": "Budi" },
            { "type": "text", "text": "INV-20260820-001" }
          ]
        }
      ]
    }
  }'
\`\`\`

### Example: Node.js / TypeScript Integration

\`\`\`typescript
const API_KEY = process.env.WHATSAPP_ORG_API_KEY!
const BASE_URL = "https://api.pfnapp.my.id"

async function sendWhatsAppMessage(to: string, templateName: string) {
  const response = await fetch(\`\${BASE_URL}/api/whatsapp/messages\`, {
    method: "POST",
    headers: {
      "Authorization": \`Bearer \${API_KEY}\`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to,
      type: "template",
      template: {
        name: templateName,
        language: { code: "id" },
      },
    }),
  })

  if (!response.ok) {
    const errorBody = await response.json()
    throw new Error(\`API Error [\${response.status}]: \${JSON.stringify(errorBody)}\`)
  }

  return response.json()
}
\`\`\`

---

## 5. Audit & Compliance

All API key lifecycle events are recorded in the immutable audit log:
- \`ORGANIZATION_API_KEY_GENERATED\`
- \`ORGANIZATION_API_KEY_ROTATED\`
- \`ORGANIZATION_API_KEY_REVOKED\`

Organization administrators can view historical activity and fingerprint records under the **Audit Logs** tab in the management console.
    `.trim(),
  },
]

export class KnowledgeDocsSeeder extends BaseSeeder {
  static override readonly seederName = "KnowledgeDocs"
  static override readonly classification = "system" as const
  static override readonly runOrder = 15
  static override readonly description =
    "Seeds and synchronizes public knowledge base documentation and vector embeddings"

  async seed(): Promise<void> {
    this.log("Starting KnowledgeDocs seeder...")

    for (const doc of CANONICAL_DOCUMENTS) {
      const contentHash = createHash("sha256")
        .update(doc.title + doc.purpose + doc.markdown)
        .digest("hex")

      const searchText = [
        doc.path,
        doc.title,
        doc.purpose,
        ...doc.howTo,
        ...doc.notes,
        doc.markdown,
      ]
        .join(" ")
        .toLowerCase()

      const existing = await this.prisma.docsKnowledgeDocument.findFirst({
        where: { path: doc.path, organizationId: null },
      })

      if (!existing) {
        this.log(`Creating knowledge doc: ${doc.path}`)
        let embedding: number[] = []
        try {
          embedding = await embedDocument({
            path: doc.path,
            title: doc.title,
            purpose: doc.purpose,
            howTo: doc.howTo,
            notes: doc.notes,
          })
        } catch {
          embedding = []
        }

        await this.prisma.docsKnowledgeDocument.create({
          data: {
            organizationId: null,
            path: doc.path,
            title: doc.title,
            purpose: doc.purpose,
            category: doc.category,
            contentMarkdown: doc.markdown,
            contentHash,
            isPublic: true,
            howTo: doc.howTo,
            notes: doc.notes,
            searchText,
            embedding,
            updatedByWorkosUserId: "system",
          },
        })
        this.trackCreated()
      } else if (existing.contentHash !== contentHash) {
        this.log(`Updating knowledge doc (content changed): ${doc.path}`)
        let embedding: number[] = []
        try {
          embedding = await embedDocument({
            path: doc.path,
            title: doc.title,
            purpose: doc.purpose,
            howTo: doc.howTo,
            notes: doc.notes,
          })
        } catch {
          embedding = existing.embedding
        }

        await this.prisma.docsKnowledgeDocument.update({
          where: { id: existing.id },
          data: {
            title: doc.title,
            purpose: doc.purpose,
            category: doc.category,
            contentMarkdown: doc.markdown,
            contentHash,
            isPublic: true,
            howTo: doc.howTo,
            notes: doc.notes,
            searchText,
            embedding,
            updatedAt: new Date(),
          },
        })
        this.trackUpdated()
      } else {
        this.log(`Skipping unchanged knowledge doc: ${doc.path}`)
        this.trackSkipped()
      }
    }
  }
}

registerSeeder(KnowledgeDocsSeeder)
