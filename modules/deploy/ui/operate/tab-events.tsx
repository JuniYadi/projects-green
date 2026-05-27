"use client"

import { useState } from "react"
import { Calendar, CheckCircle, Warning, ClockCounterClockwise } from "@phosphor-icons/react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type RolloutEvent = {
  id: string
  version: string
  commitSha: string
  status: "succeeded" | "failed" | "rolled_back"
  message: string
  deployedAt: string
}

const MOCK_ROLLOUT_EVENTS: RolloutEvent[] = [
  {
    id: "event-1",
    version: "v1.4.0",
    commitSha: "abc1234",
    status: "succeeded",
    message: "Deployed latest feature branch",
    deployedAt: "2026-05-19T08:30:00Z",
  },
  {
    id: "event-2",
    version: "v1.3.2",
    commitSha: "def5678",
    status: "succeeded",
    message: "Previous stable release",
    deployedAt: "2026-05-18T14:15:00Z",
  },
  {
    id: "event-3",
    version: "v1.3.1",
    commitSha: "ghi9012",
    status: "succeeded",
    message: "Stable release",
    deployedAt: "2026-05-17T10:00:00Z",
  },
  {
    id: "event-4",
    version: "v1.3.0",
    commitSha: "jkl3456",
    status: "rolled_back",
    message: "Rolled back due to memory leak",
    deployedAt: "2026-05-16T09:30:00Z",
  },
  {
    id: "event-5",
    version: "v1.2.9",
    commitSha: "mno7890",
    status: "failed",
    message: "OOM during startup",
    deployedAt: "2026-05-15T11:00:00Z",
  },
]

export function TabEvents() {
  const [eventFilter, setEventFilter] = useState<
    "all" | "succeeded" | "failed" | "rolled_back"
  >("all")

  const filteredEvents =
    eventFilter === "all"
      ? MOCK_ROLLOUT_EVENTS
      : MOCK_ROLLOUT_EVENTS.filter((item) => item.status === eventFilter)

  return (
    <Card className="border-white/[0.08] bg-[#0A0A0C]/50 shadow-xl backdrop-blur-md">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-6">
        <div className="space-y-1">
          <CardTitle className="text-base font-bold text-white">
            Rollout History
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Timeline of deploy, promote, and rollback actions
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Filter:
          </span>
          <Select
            value={eventFilter}
            onValueChange={(value) =>
              setEventFilter(
                value as "all" | "succeeded" | "failed" | "rolled_back"
              )
            }
          >
            <SelectTrigger className="h-8 w-[140px] rounded-lg border-white/[0.08] bg-white/[0.02] text-xs text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-white/[0.08] bg-neutral-900 text-white">
              <SelectItem value="all">All events</SelectItem>
              <SelectItem value="succeeded">Succeeded</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="rolled_back">Rolled back</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {filteredEvents.length > 0 ? (
            filteredEvents.map((item) => (
              <div
                key={item.id}
                className="group relative flex gap-4 rounded-xl border border-white/[0.04] bg-white/[0.01] p-4 transition-all hover:bg-white/[0.03]"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/[0.04] transition-colors group-hover:bg-white/[0.08]">
                  {item.status === "succeeded" && (
                    <CheckCircle size={20} className="text-emerald-400" />
                  )}
                  {item.status === "failed" && (
                    <Warning size={20} className="text-rose-400" />
                  )}
                  {item.status === "rolled_back" && (
                    <ClockCounterClockwise size={20} className="text-amber-400" />
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-white">
                      {item.version}{" "}
                      <span className="ml-1 font-mono text-[10px] font-medium text-muted-foreground">
                        ({item.commitSha})
                      </span>
                    </h4>
                    <span className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
                      <Calendar size={12} />
                      {new Date(item.deployedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {item.message}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        item.status === "succeeded"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : item.status === "failed"
                            ? "bg-rose-500/10 text-rose-400"
                            : "bg-amber-500/10 text-amber-400"
                      }`}
                    >
                      {item.status.replace("_", " ")}
                    </span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.04]">
                <ClockCounterClockwise size={24} className="text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-white">No events found</p>
              <p className="text-xs text-muted-foreground">
                Try adjusting your filters to see more rollout events.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
