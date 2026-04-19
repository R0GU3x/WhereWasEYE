"use client"

import { memo } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import { cn } from "@/lib/utils"

export type NodeStatus = 
  | "not-yet"
  | "queued"
  | "running"
  | "needs-review"
  | "interesting"
  | "false-positive"
  | "exploitable"
  | "pwned"

export interface CyberNodeData extends Record<string, unknown> {
  label: string
  status: NodeStatus
  entityType: string
  notes: string
  createdAt: string
}

const statusStyles: Record<NodeStatus, string> = {
  "not-yet": "border-border bg-card shadow-[0_0_15px_rgba(100,100,120,0.15)]",
  "queued": "border-[var(--node-queued)] bg-card shadow-[0_0_20px_rgba(255,255,255,0.25)]",
  "running": "border-[var(--node-running)] bg-card shadow-[0_0_20px_rgba(100,150,255,0.3)]",
  "needs-review": "border-[var(--node-needs-review)] bg-card shadow-[0_0_20px_rgba(200,150,255,0.3)]",
  "interesting": "border-[var(--node-interesting)] bg-card shadow-[0_0_20px_rgba(255,165,0,0.3)]",
  "false-positive": "border-[var(--node-false-positive)] bg-card shadow-[0_0_20px_rgba(139,90,43,0.25)]",
  "exploitable": "border-[var(--node-exploitable)] bg-card shadow-[0_0_25px_rgba(255,50,50,0.4)]",
  "pwned": "border-[var(--node-pwned)] bg-card shadow-[0_0_20px_rgba(100,220,150,0.3)]",
}

const statusIndicators: Record<NodeStatus, string> = {
  "not-yet": "bg-muted-foreground",
  "queued": "bg-[var(--node-queued)]",
  "running": "bg-[var(--node-running)] animate-pulse",
  "needs-review": "bg-[var(--node-needs-review)]",
  "interesting": "bg-[var(--node-interesting)]",
  "false-positive": "bg-[var(--node-false-positive)]",
  "exploitable": "bg-[var(--node-exploitable)] animate-pulse",
  "pwned": "bg-[var(--node-pwned)]",
}

function CyberNodeComponent({ data, selected }: NodeProps) {
  const nodeData = data as unknown as CyberNodeData

  return (
    <div
      className={cn(
        "min-w-[140px] rounded-lg border-2 px-4 py-3 transition-all duration-200",
        statusStyles[nodeData.status],
        selected && "ring-2 ring-primary ring-offset-2 ring-offset-background"
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!h-3 !w-3 !border-2 !border-primary !bg-background"
      />
      
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "h-2.5 w-2.5 rounded-full",
            statusIndicators[nodeData.status]
          )}
        />
        <span className="font-mono text-sm font-medium text-foreground">
          {nodeData.label}
        </span>
      </div>
      
      {nodeData.entityType && (
        <div className="mt-1 font-mono text-xs text-muted-foreground">
          {nodeData.entityType}
        </div>
      )}
      
      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-3 !w-3 !border-2 !border-primary !bg-background"
      />
    </div>
  )
}

export const CyberNode = memo(CyberNodeComponent)
