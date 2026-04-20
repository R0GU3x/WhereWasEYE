"use client"

import { useEffect, useRef, useState } from "react"
import type { Node } from "@xyflow/react"
import type { CyberNodeData, NodeStatus } from "./cyber-node"
import { cn } from "@/lib/utils"

interface DetailPanelProps {
  node: Node<CyberNodeData>
  onClose: () => void
  onUpdateNode: (nodeId: string, data: Partial<CyberNodeData>) => void
  onDeleteNode?: (nodeId: string) => void
}

const statusLabels: Record<NodeStatus, { label: string; className: string }> = {
  "default": { label: "Default", className: "text-muted-foreground" },
  "in-progress": { label: "In-Progress", className: "text-[var(--node-in-progress)]" },
  "pending": { label: "Pending", className: "text-[var(--node-pending)]" },
  "success": { label: "Success", className: "text-[var(--node-success)]" },
  "failed": { label: "Failed", className: "text-[var(--node-failed)]" },
  "interesting": { label: "Interesting", className: "text-[var(--node-interesting)]" },
}

export function DetailPanel({ node, onClose, onUpdateNode, onDeleteNode }: DetailPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
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
          <div className={cn("mt-1 text-sm", statusLabels[data.status]?.className || "text-muted-foreground")}>
            {statusLabels[data.status]?.label || data.status || "Unknown"}
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

        {/* Delete Button with Confirmation */}
        {onDeleteNode && (
          <div className="border-t border-border pt-4">
            {showDeleteConfirm ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Delete this node and all connected edges?</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 rounded px-3 py-1.5 text-sm font-medium border border-border hover:bg-muted transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      onDeleteNode(node.id)
                      onClose()
                    }}
                    className="flex-1 rounded px-3 py-1.5 text-sm font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full rounded px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
              >
                Delete Node
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
