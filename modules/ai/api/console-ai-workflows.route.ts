import { Elysia, t } from "elysia"
import { requireConsoleOrgAuth } from "@/modules/ai/api/console-ai-providers.route"
import {
  WorkflowDefinitionSchema,
  type WorkflowDefinition,
} from "@/modules/whatsapp/workflow/workflow.schema"

export interface GenerateWorkflowResponse {
  ok: boolean
  workflow?: WorkflowDefinition
  summary?: string
  error?: string
}

export function buildTemplateWorkflow(
  prompt: string,
  options?: {
    organizationId?: string
    name?: string
    description?: string
  }
): { workflow: WorkflowDefinition; summary: string } {
  const lower = prompt.toLowerCase()
  const workflowId = `wf_${Date.now()}`
  const orgId = options?.organizationId || "org_default"

  // Preset 1: Resi / Cek Status Pengiriman / Order Tracking
  if (
    lower.includes("resi") ||
    lower.includes("lacak") ||
    lower.includes("kirim") ||
    lower.includes("tracking") ||
    lower.includes("status pesanan")
  ) {
    const workflow: WorkflowDefinition = {
      id: workflowId,
      organizationId: orgId,
      name: options?.name || "Cek Status Pengiriman & Resi",
      description:
        options?.description ||
        "Alur otomatis tanya nomor resi lalu balas status pengiriman",
      isActive: true,
      isDefault: false,
      trigger: {
        id: "trig_resi",
        type: "keyword_match",
        keywords: ["resi", "lacak", "status", "kirim", "paket", "cek"],
      },
      nodes: [
        {
          id: "node_ask_resi",
          type: "prompt_input",
          name: "Tanya Nomor Resi",
          config: {
            question:
              "Halo! Silakan ketik *Nomor Resi / Pesanan* Anda untuk mengecek status pengiriman:",
            captureVariable: "no_resi",
            validation: {
              type: "text",
              errorMessage: "Nomor resi tidak valid. Mohon periksa kembali.",
            },
          },
        },
        {
          id: "node_send_status",
          type: "send_message",
          name: "Kirim Status Resi",
          config: {
            messageType: "text",
            text: "📦 *Status Pengiriman Pesanan*\nNo. Resi: `{{variables.no_resi}}`\nStatus: *Dalam Perjalanan (Kurir Sedang Mengantar)*\n\nTerima kasih telah berbelanja bersama kami! 🙏",
          },
        },
      ],
      edges: [
        {
          id: "edge_1",
          sourceNodeId: "node_ask_resi",
          targetNodeId: "node_send_status",
          sourcePort: "default",
        },
      ],
      version: 1,
    }

    return {
      workflow,
      summary:
        "AI merancang alur 2-langkah: Menanyakan nomor resi pembeli lalu membalas status paket secara otomatis.",
    }
  }

  // Preset 2: Form Kontak / Pendaftaran / Lead Gen
  if (
    lower.includes("daftar") ||
    lower.includes("lead") ||
    lower.includes("registrasi") ||
    lower.includes("kontak") ||
    lower.includes("formulir")
  ) {
    const workflow: WorkflowDefinition = {
      id: workflowId,
      organizationId: orgId,
      name: options?.name || "Formulir Pendaftaran & Konsultasi",
      description:
        options?.description ||
        "Alur pengumpulan data prospek (Nama & Kebutuhan) secara bertahap",
      isActive: true,
      isDefault: false,
      trigger: {
        id: "trig_reg",
        type: "keyword_match",
        keywords: ["daftar", "gabung", "info", "konsultasi", "join"],
      },
      nodes: [
        {
          id: "node_ask_name",
          type: "prompt_input",
          name: "Tanya Nama",
          config: {
            question:
              "Halo kak! 👋 Sebelum memulai, boleh sebutkan *Nama Lengkap* Anda?",
            captureVariable: "nama_user",
            validation: {
              type: "text",
            },
          },
        },
        {
          id: "node_ask_need",
          type: "prompt_input",
          name: "Tanya Kebutuhan",
          config: {
            question:
              "Salam kenal Kak *{{variables.nama_user}}*! Apa produk atau layanan yang sedang dicari?",
            captureVariable: "kebutuhan",
            validation: {
              type: "text",
            },
          },
        },
        {
          id: "node_confirm",
          type: "send_message",
          name: "Konfirmasi Penerimaan Data",
          config: {
            messageType: "text",
            text: "Terima kasih Kak *{{variables.nama_user}}*!\nData kebutuhan Anda (`{{variables.kebutuhan}}`) sudah kami terima. Tim kami akan segera menghubungi nomor ini.",
          },
        },
      ],
      edges: [
        {
          id: "edge_1",
          sourceNodeId: "node_ask_name",
          targetNodeId: "node_ask_need",
          sourcePort: "default",
        },
        {
          id: "edge_2",
          sourceNodeId: "node_ask_need",
          targetNodeId: "node_confirm",
          sourcePort: "default",
        },
      ],
      version: 1,
    }

    return {
      workflow,
      summary:
        "AI merancang alur pendaftaran 3-langkah: Tanya nama pembeli -> Tanya kebutuhan -> Kirim ucapan terima kasih & simpan data.",
    }
  }

  // Default Preset: FAQ & Menu Sambutan Pintar
  const workflow: WorkflowDefinition = {
    id: workflowId,
    organizationId: orgId,
    name: options?.name || "Menu Sambutan & Layanan Pelanggan",
    description:
      options?.description ||
      "Alur otomatis menyapa pelanggan dengan tombol menu pilihan",
    isActive: true,
    isDefault: false,
    trigger: {
      id: "trig_welcome",
      type: "keyword_match",
      keywords: ["halo", "hi", "hai", "menu", "pagi", "siang", "malam"],
    },
    nodes: [
      {
        id: "node_welcome_menu",
        type: "send_interactive",
        name: "Menu Pilihan WhatsApp",
        config: {
          interactiveType: "button",
          bodyText:
            "Halo! Selamat datang di layanan pelanggan resmi kami. Silakan pilih layanan yang Anda butuhkan:",
          buttons: [
            { id: "btn_katalog", title: "Katalog Produk" },
            { id: "btn_tanya_cs", title: "Tanya Customer Service" },
          ],
        },
      },
    ],
    edges: [],
    version: 1,
  }

  return {
    workflow,
    summary:
      "AI merancang alur sambutan interaktif dengan tombol menu pilihan cepat (Katalog & CS).",
  }
}

export function createConsoleAiWorkflowsRoutes() {
  return new Elysia({ prefix: "/console/ai/workflows" }).post(
    "/generate",
    async ({ body, set }) => {
      const auth = await requireConsoleOrgAuth()
      if ("error" in auth) {
        set.status = auth.status
        return { ok: false, error: auth.error }
      }

      const { prompt, name, description } = body
      if (!prompt?.trim()) {
        set.status = 400
        return { ok: false, error: "Prompt tidak boleh kosong" }
      }

      try {
        const result = buildTemplateWorkflow(prompt, {
          organizationId: auth.orgId,
          name,
          description,
        })

        // Validate generated schema
        const parsed = WorkflowDefinitionSchema.safeParse(result.workflow)
        if (!parsed.success) {
          set.status = 422
          return {
            ok: false,
            error: "Schema validation failed for generated workflow",
          }
        }

        return {
          ok: true,
          workflow: parsed.data,
          summary: result.summary,
        }
      } catch (err) {
        set.status = 500
        return {
          ok: false,
          error: err instanceof Error ? err.message : "Internal Server Error",
        }
      }
    },
    {
      body: t.Object({
        prompt: t.String(),
        name: t.Optional(t.String()),
        description: t.Optional(t.String()),
      }),
    }
  )
}
