/**
 * Template Code Snippet Dialog
 *
 * Provides ready-to-copy code snippets for sending WhatsApp templates
 * across multiple languages (cURL, Node.js, Python, PHP, Go).
 */

"use client"

import * as React from "react"
import { Check, Copy, Code } from "@phosphor-icons/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type {
  WhatsAppTemplate,
  WhatsAppTemplateLanguage,
} from "@/lib/api/whatsapp-client"
import type { TemplatePreviewValues } from "./template-preview"
import { getTemplatePlaceholderIndexes } from "./template-preview"

type TemplateCodeSnippetDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  template: WhatsAppTemplate
  selectedLanguage: WhatsAppTemplateLanguage
  variableValues: TemplatePreviewValues
  recipientPhone?: string
}

export function generateTemplatePayload(
  template: WhatsAppTemplate,
  language: WhatsAppTemplateLanguage,
  variableValues: TemplatePreviewValues,
  recipientPhone = "+6281234567890"
) {
  const placeholderIndexes = getTemplatePlaceholderIndexes(language.body)
  const components: Array<Record<string, unknown>> = []

  // Body component
  if (placeholderIndexes.length > 0) {
    components.push({
      type: "body",
      parameters: placeholderIndexes.map((idx) => ({
        type: "text",
        text: variableValues[idx] || `Sample ${idx}`,
      })),
    })
  }

  // Button components (e.g. OTP button URL parameter if applicable)
  const buttons = Array.isArray(language.buttons) ? language.buttons : []
  buttons.forEach((btn, index) => {
    const btnObj = btn as Record<string, unknown>
    const isOtpOrUrlWithVar =
      btnObj.type === "OTP" ||
      btnObj.type === "URL" ||
      (typeof btnObj.url === "string" && btnObj.url.includes("{{"))

    if (isOtpOrUrlWithVar && placeholderIndexes.length > 0) {
      components.push({
        type: "button",
        sub_type: "url",
        index,
        parameters: [
          {
            type: "text",
            text: variableValues[1] || `Sample 1`,
          },
        ],
      })
    }
  })

  return {
    to: recipientPhone,
    type: "template",
    template: {
      name: template.slug,
      language: {
        code: language.lang,
      },
      ...(components.length > 0 ? { components } : {}),
    },
  }
}

export function TemplateCodeSnippetDialog({
  open,
  onOpenChange,
  template,
  selectedLanguage,
  variableValues,
  recipientPhone = "+6281234567890",
}: TemplateCodeSnippetDialogProps) {
  const [copied, setCopied] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState("curl")

  const payload = React.useMemo(
    () =>
      generateTemplatePayload(
        template,
        selectedLanguage,
        variableValues,
        recipientPhone
      ),
    [template, selectedLanguage, variableValues, recipientPhone]
  )

  const jsonString = JSON.stringify(payload, null, 2)

  const snippets: Record<string, string> = {
    curl: `curl -X POST "https://pfnapp.my.id/api/v1/whatsapp/messages" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(payload, null, 2)}'`,

    node: `// Node.js (Fetch API)
const response = await fetch("https://pfnapp.my.id/api/v1/whatsapp/messages", {
  method: "POST",
  headers: {
    "Authorization": \`Bearer \${process.env.WHATSAPP_API_KEY}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(${jsonString}),
});

const data = await response.json();
console.log("Response:", data);`,

    python: `# Python (requests)
import os
import requests

url = "https://pfnapp.my.id/api/v1/whatsapp/messages"
headers = {
    "Authorization": f"Bearer {os.environ.get('WHATSAPP_API_KEY')}",
    "Content-Type": "application/json"
}
payload = ${jsonString.replace(/true/g, "True").replace(/false/g, "False").replace(/null/g, "None")}

response = requests.post(url, json=payload, headers=headers)
print(response.json())`,

    php: `<?php
// PHP (cURL)
$apiKey = getenv('WHATSAPP_API_KEY');
$url = "https://pfnapp.my.id/api/v1/whatsapp/messages";
$payload = '${jsonString}';

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "Authorization: Bearer " . $apiKey,
    "Content-Type: application/json"
]);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

$response = curl_exec($ch);
curl_close($ch);

echo $response;`,

    go: `// Go
package main

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"os"
)

func main() {
	url := "https://pfnapp.my.id/api/v1/whatsapp/messages"
	payload := []byte(\`${jsonString}\`)

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(payload))
	if err != nil {
		panic(err)
	}

	req.Header.Set("Authorization", "Bearer "+os.Getenv("WHATSAPP_API_KEY"))
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		panic(err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	fmt.Println(string(body))
}`,
  }

  const handleCopy = (code: string) => {
    void navigator.clipboard.writeText(code)
    setCopied(true)
    toast.success("Code snippet copied to clipboard!")
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl sm:max-w-3xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <Code className="size-5" />
            </div>
            <div>
              <DialogTitle>Developer Integration Code</DialogTitle>
              <DialogDescription>
                Ready-to-use code snippet populated with your template variables
                and structure.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="flex items-center justify-between border-b pb-2">
            <TabsList className="h-9">
              <TabsTrigger value="curl" className="text-xs">
                cURL
              </TabsTrigger>
              <TabsTrigger value="node" className="text-xs">
                Node.js
              </TabsTrigger>
              <TabsTrigger value="python" className="text-xs">
                Python
              </TabsTrigger>
              <TabsTrigger value="php" className="text-xs">
                PHP
              </TabsTrigger>
              <TabsTrigger value="go" className="text-xs">
                Go
              </TabsTrigger>
            </TabsList>

            <Button
              size="sm"
              variant="outline"
              onClick={() => handleCopy(snippets[activeTab])}
              className="h-8 gap-1.5 text-xs"
            >
              {copied ? (
                <>
                  <Check className="size-3.5 text-emerald-500" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="size-3.5" />
                  Copy Snippet
                </>
              )}
            </Button>
          </div>

          {Object.entries(snippets).map(([lang, code]) => (
            <TabsContent key={lang} value={lang} className="mt-3">
              <div className="relative rounded-lg border bg-muted/40 p-4 font-mono text-xs leading-relaxed dark:bg-black/40">
                <pre className="max-h-[360px] overflow-x-auto overflow-y-auto whitespace-pre">
                  <code>{code}</code>
                </pre>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
