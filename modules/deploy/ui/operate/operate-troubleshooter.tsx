"use client"

import { useState } from "react"
import {
  MagnifyingGlass,
  Wrench,
  ArrowRight,
} from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"

import type { OperateTabId } from "@/modules/deploy/operate.constants"

type OperateTroubleshooterProps = {
  isOpen: boolean
  onClose: () => void
  onDeepLink: (tab: OperateTabId) => void
}

const FAQ_LIST: Array<{
  q: string
  a: string
  tab: OperateTabId
}> = [
  {
    q: "1. How do I manage my app?",
    a: "Manage your app configurations through the tabs above: 'Overview' tracks general deployment states and trigger rebuilds, 'Domains & SSL' configures ingress records and TLS certificates, 'Environment & Networking' handles configuration variables, 'Storage & Mounts' mounts configuration files/secrets into container pods, 'Autoscaling' scales replicas dynamically, and 'Metrics' tracks load.",
    tab: "overview",
  },
  {
    q: "2. How do I change or custom domain? What DNS should I set?",
    a: "Go to the 'Domains & SSL' tab, enter your domain name, and save. To verify, create an A Record in your DNS dashboard pointing to our IP: 76.76.21.21, or add a CNAME record targeting: laravel-shop.projects-green.dev.",
    tab: "domains",
  },
  {
    q: "3. How do I add environment variables?",
    a: "Go to the 'Environment & Net' tab. Enter the variable Name and Value. Toggle the 'Secret Value' option to mask the variable on the interface and store it encrypted in secrets. Click 'Save Variable'. You can also import `.env` files in bulk using the 'Bulk Import' simulator.",
    tab: "env",
  },
  {
    q: "4. I want to mount a private key file, how?",
    a: "Under the 'Storage & Mounts' tab, create a new Volume Mount. Provide a target Container Path (e.g. /var/www/html/storage/app/key.pem), set the mode to read-only, choose 'Secret (PEM)' as the source type, and paste your PEM key block. The platform mounts it as a secure file into your container pods.",
    tab: "mounts",
  },
  {
    q: "5. I want to rebuild my repository, there is an update. How?",
    a: "On the 'Overview' tab, locate the repository details. Click the 'Trigger Rebuild & Deploy' button. The platform pulls the latest updates from your repository, runs build configurations, validates health checks, and initiates a rolling update.",
    tab: "overview",
  },
  {
    q: "6. I want to see status of my app, why cannot I access it?",
    a: "Check the 'Overview' tab -> 'Accessibility & Port Diagnostics'. If the status is degraded or inaccessible, select the simulator options. A common issue is a Port Mismatch (the app is listening on port 3000 but the load balancer is routing traffic to port 80). The diagnostics card lists remediation suggestions.",
    tab: "overview",
  },
  {
    q: "7. My app is slow, is resource enough to handle the traffic? Where can I see metrics?",
    a: "Go to the 'Telemetry & Metrics' tab to view live CPU, RAM, and HTTP network requests. If usage is close to 100%, consider customizing limits under 'Scaling & Tuning' or enable Horizontal Pod Autoscaling (HPA) to spin up extra replicas.",
    tab: "metrics",
  },
  {
    q: "8. My SSL expired, why is the site not showing that?",
    a: "Check the domain certificates list under 'Domains & SSL'. If a domain shows 'Expired', click 'Force SSL Renewal' to trigger a verification. Note that web browsers heavily cache old SSL data; try testing via incognito or curl -Iv https://yourdomain.com.",
    tab: "domains",
  },
  {
    q: "9. I'm behind Cloudflare, my SSL cannot activate. Why?",
    a: "When Cloudflare Proxy (Orange Cloud) is active, Let's Encrypt HTTP challenges cannot verify domain ownership. Temporarily switch Cloudflare to 'DNS Only' (Grey Cloud) to allow verification to complete, then re-enable the proxy after SSL is active.",
    tab: "domains",
  },
  {
    q: "10. I'm behind Cloudflare, and it is in a redirect loop. How do I fix it?",
    a: "If Cloudflare is set to 'Flexible' SSL, it connects to our origin server via HTTP. Since our server redirects all HTTP traffic to HTTPS, this creates an infinite loop. Solution: Navigate to Cloudflare -> SSL/TLS settings, and change the SSL encryption mode to 'Full' or 'Full (strict)'.",
    tab: "domains",
  },
  {
    q: "11. I'm behind a proxy, client IPs show local IP instead of real IP.",
    a: "Go to 'Environment & Net' -> 'Reverse Proxy Configuration'. Toggle 'Trust Reverse Proxy Forwarded Headers'. This configures nginx/app ingress to read client IPs from the X-Forwarded-For header instead of returning internal load balancer node IPs.",
    tab: "env",
  },
  {
    q: "12. I need to customize my app resource because of lack of RAM.",
    a: "Go to the 'Autoscaling & Tuning' tab. Locate 'Resource Sizing'. You can scale Memory limits and CPU limits directly by typing or sliding. Click 'Save configurations' to initiate a rolling update with the new constraints.",
    tab: "scaling",
  },
  {
    q: "13. I need to add replica on my server, or enable HPA or VPA limits.",
    a: "Go to 'Autoscaling & Tuning' tab -> scaling policies. You can manually adjust the replica counter, or toggle 'Horizontal Pod Autoscaler (HPA)' to set minimum/maximum replicas and target load metrics. Toggle VPA to let the cluster optimize limits automatically.",
    tab: "scaling",
  },
  {
    q: "14. I need to see logs of my app (Opensearch Integration).",
    a: "Navigate to the 'Opensearch Log Viewer' tab. You can search key terms, filter by logs level (INFO, WARN, ERROR), and toggle live-tail streams. This is powered directly by our backend cluster Opensearch indexing.",
    tab: "logs",
  },
]

export function OperateTroubleshooter({
  isOpen,
  onClose,
  onDeepLink,
}: OperateTroubleshooterProps) {
  const [troubleshooterSearch, setTroubleshooterSearch] = useState("")

  if (!isOpen) return null

  const filteredFaqs = FAQ_LIST.filter(
    (f) =>
      f.q.toLowerCase().includes(troubleshooterSearch.toLowerCase()) ||
      f.a.toLowerCase().includes(troubleshooterSearch.toLowerCase())
  )

  const handleDeepLink = (tab: OperateTabId) => {
    onDeepLink(tab)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex justify-end">
      <div className="bg-neutral-950 border-l border-white/10 w-full max-w-lg p-6 space-y-5 overflow-y-auto flex flex-col h-full shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Wrench size={18} className="text-primary" /> Application
              Operations FAQ
            </h3>
            <p className="text-xs text-muted-foreground">
              Self-serve answers to operations and troubleshooting
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="text-muted-foreground hover:text-white"
          >
            Close
          </Button>
        </div>

        {/* FAQ Search */}
        <div className="relative">
          <MagnifyingGlass
            size={16}
            className="absolute left-3 top-2.5 text-muted-foreground"
          />
          <input
            type="text"
            placeholder="Search troubleshooting questions..."
            value={troubleshooterSearch}
            onChange={(e) => setTroubleshooterSearch(e.target.value)}
            className="bg-black/50 text-white rounded-lg border border-white/[0.1] pl-9 pr-3 py-2 w-full text-xs focus:outline-none"
          />
        </div>

        {/* Questions List */}
        <div className="flex-1 space-y-4 overflow-y-auto pr-1">
          {filteredFaqs.map((faq, idx) => (
            <div
              key={idx}
              className="rounded-lg border border-white/[0.06] bg-black/35 p-4 space-y-2"
            >
              <h4 className="font-bold text-white text-xs leading-snug">
                {faq.q}
              </h4>
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                {faq.a}
              </p>
              <button
                type="button"
                onClick={() => handleDeepLink(faq.tab)}
                className="inline-flex items-center gap-1.5 text-[10px] text-primary font-semibold hover:underline mt-1 cursor-pointer"
              >
                Go to Setting <ArrowRight size={10} />
              </button>
            </div>
          ))}

          {filteredFaqs.length === 0 && (
            <div className="p-8 text-center text-muted-foreground text-xs">
              No matches for search terms. Try keywords like &quot;SSL&quot;,
              &quot;Cloudflare&quot;, &quot;metrics&quot;, &quot;replica&quot;,
              or &quot;private&quot;.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
