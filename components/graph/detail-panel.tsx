"use client"

import { useEffect, useRef } from "react"
import type { Node } from "@xyflow/react"
import type { CyberNodeData, NodeStatus } from "./cyber-node"
import { cn } from "@/lib/utils"

interface DetailPanelProps {
  node: Node<CyberNodeData>
  onClose: () => void
  onUpdateNode: (nodeId: string, data: Partial<CyberNodeData>) => void
}

const statusLabels: Record<NodeStatus, { label: string; className: string }> = {
  default: { label: "Default", className: "text-muted-foreground" },
  "in-progress": { label: "In Progress", className: "text-[var(--node-in-progress)]" },
  paused: { label: "Paused", className: "text-[var(--node-paused)]" },
  success: { label: "Success", className: "text-[var(--node-success)]" },
  failed: { label: "Failed", className: "text-[var(--node-failed)]" },
}

export function DetailPanel({ node, onClose, onUpdateNode }: DetailPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const data = node.data as CyberNodeData

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose()
      }
    }
    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [onClose])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    })
  }

  return (
    <div
      ref={panelRef}
      className="absolute right-4 top-4 z-40 w-80 rounded-lg border border-border bg-card/95 p-4 shadow-xl backdrop-blur-sm"
    >
      <div className="mb-4 flex items-start justify-between">
        <div>
          <input
            type="text"
            value={data.label}
            onChange={(e) => onUpdateNode(node.id, { label: e.target.value })}
            className="bg-transparent font-mono text-lg font-semibold text-foreground outline-none focus:border-b focus:border-primary"
          />
          <div className={cn("mt-1 text-sm", statusLabels[data.status].className)}>
            {statusLabels[data.status].label}
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Created
          </label>
          <div className="font-mono text-sm text-foreground">
            {formatDate(data.createdAt)}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Entity Type
          </label>
          <input
            type="text"
            value={data.entityType}
            onChange={(e) => onUpdateNode(node.id, { entityType: e.target.value })}
            placeholder="e.g., nmap, ffuf, exploit"
            className="w-full rounded border border-border bg-input px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Notes
          </label>
          <textarea
            value={data.notes}
            onChange={(e) => onUpdateNode(node.id, { notes: e.target.value })}
            placeholder="Add notes about this step..."
            rows={5}
            className="w-full resize-none rounded border border-border bg-input px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>
    </div>
  )
}
