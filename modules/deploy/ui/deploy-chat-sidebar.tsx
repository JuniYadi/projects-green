"use client"

import {
  ChatCircle,
  InfoIcon,
  Lightning,
  Warning,
  CheckCircle,
  X,
} from "@/components/ui/phosphor-icons"
import { cn } from "@/lib/utils"
import type {
  DeploySourceType,
  DeployStep,
  ResourcePlanId,
} from "@/modules/deploy/deploy.types"

type HintType = "info" | "tip" | "warning" | "success"

type ContextualHint = {
  id: string
  type: HintType
  message: string
  showWhen?: boolean
}

type ChatContext = {
  step: DeployStep
  sourceType: DeploySourceType
  githubConnected: boolean
  userName: string
  framework: string | null
  confidence: "high" | "medium" | "low" | null
  resourcePlan: ResourcePlanId
}

type DeployChatSidebarProps = {
  context: ChatContext
  isCollapsed: boolean
  onToggleCollapse: () => void
}

const HINT_STYLES: Record<
  HintType,
  { bg: string; border: string; icon: typeof InfoIcon; iconColor: string }
> = {
  info: {
    bg: "bg-blue-50/80",
    border: "border-blue-200",
    icon: InfoIcon,
    iconColor: "text-blue-500",
  },
  tip: {
    bg: "bg-amber-50/80",
    border: "border-amber-200",
    icon: Lightning,
    iconColor: "text-amber-500",
  },
  warning: {
    bg: "bg-orange-50/80",
    border: "border-orange-200",
    icon: Warning,
    iconColor: "text-orange-500",
  },
  success: {
    bg: "bg-green-50/80",
    border: "border-green-200",
    icon: CheckCircle,
    iconColor: "text-green-500",
  },
}

const DEPLOY_CHAT_HINTS: Record<
  DeployStep,
  (ctx: ChatContext) => ContextualHint[]
> = {
  source: (ctx) => [
    { id: "source-1", type: "info", message: "What are you deploying today?" },
    {
      id: "source-2",
      type: "tip",
      message:
        "Connect your GitHub account for one-click deploys from your repos.",
      showWhen: !ctx.githubConnected,
    },
    {
      id: "source-3",
      type: "tip",
      message: `Connected as ${ctx.userName}. Pick a repo to deploy.`,
      showWhen: ctx.githubConnected,
    },
    {
      id: "source-5",
      type: "info",
      message: "Pick a template. We'll pre-configure everything for you.",
      showWhen: ctx.sourceType === "template",
    },
  ],
  build: (ctx) => [
    {
      id: "build-1",
      type: "info",
      message: `Detected ${ctx.framework || "unknown"} framework.`,
    },
    {
      id: "build-2",
      type: "success",
      message: "High confidence — build settings look good.",
      showWhen: ctx.confidence === "high",
    },
    {
      id: "build-3",
      type: "warning",
      message: "Low confidence — review the build settings manually.",
      showWhen: ctx.confidence === "low",
    },
    {
      id: "build-4",
      type: "tip",
      message: "You can override auto-detected settings if needed.",
      showWhen: ctx.confidence !== "high",
    },
  ],
  environment: (ctx) => [
    {
      id: "env-1",
      type: "info",
      message: "Choose a domain and resource plan for your app.",
    },
    {
      id: "env-2",
      type: "tip",
      message:
        "Free tier includes 100MB RAM. Upgrade for production workloads.",
      showWhen: ctx.resourcePlan === "starter",
    },
    {
      id: "env-3",
      type: "tip",
      message: "PAYG billing scales with usage — great for variable traffic.",
      showWhen: ctx.resourcePlan === "payg",
    },
  ],
  monitor: () => [
    { id: "mon-1", type: "info", message: "Your deployment is being set up." },
    {
      id: "mon-2",
      type: "tip",
      message:
        "Check the timeline for status updates. Logs appear once the build starts.",
    },
  ],
}

function HintBubble({ hint }: { hint: ContextualHint }) {
  const style = HINT_STYLES[hint.type]
  const Icon = style.icon

  return (
    <div
      className={cn(
        "flex gap-3 rounded-lg border p-3 text-sm",
        style.bg,
        style.border
      )}
    >
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", style.iconColor)} />
      <p className="text-gray-700">{hint.message}</p>
    </div>
  )
}

export function DeployChatSidebar({
  context,
  isCollapsed,
  onToggleCollapse,
}: DeployChatSidebarProps) {
  const hints = DEPLOY_CHAT_HINTS[context.step](context).filter(
    (h) => h.showWhen !== false
  )

  return (
    <aside
      className={cn(
        "relative flex flex-col border-l border-gray-200 bg-white transition-all duration-300 ease-in-out",
        isCollapsed ? "w-12" : "w-80"
      )}
      aria-label="Deploy assistant"
    >
      {/* Toggle button */}
      <button
        onClick={onToggleCollapse}
        className={cn(
          "absolute top-3 flex h-9 w-9 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-700",
          isCollapsed ? "left-3" : "right-3"
        )}
        aria-label={isCollapsed ? "Expand assistant" : "Collapse assistant"}
      >
        {isCollapsed ? (
          <ChatCircle className="h-5 w-5" />
        ) : (
          <X className="h-5 w-5" />
        )}
      </button>

      {/* Expanded content */}
      {!isCollapsed && (
        <div className="flex h-full flex-col overflow-hidden pt-14">
          {/* Header */}
          <div className="flex items-center gap-2 border-b border-gray-100 px-4 pb-3">
            <ChatCircle className="h-5 w-5 text-gray-400" />
            <span className="font-medium text-gray-700">Assistant</span>
          </div>

          {/* Hints */}
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {hints.map((hint) => (
              <HintBubble key={hint.id} hint={hint} />
            ))}
          </div>
        </div>
      )}
    </aside>
  )
}
