"use client"

import { memo } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import { cn } from "@/lib/utils"

export type NodeStatus = "default" | "in-progress" | "success" | "failed"

export interface CyberNodeData {
  label: string
  status: NodeStatus
  entityType: string
  notes: string
  createdAt: string
}

const statusStyles: Record<NodeStatus, string> = {
  default: "border-border bg-card shadow-[0_0_15px_rgba(100,100,120,0.15)]",
  "in-progress": "border-[var(--node-in-progress)] bg-card shadow-[0_0_20px_rgba(100,150,255,0.3)]",
  success: "border-[var(--node-success)] bg-card shadow-[0_0_20px_rgba(100,220,150,0.3)]",
  failed: "border-[var(--node-failed)] bg-card shadow-[0_0_20px_rgba(255,100,100,0.3)]",
}

const statusIndicators: Record<NodeStatus, string> = {
  default: "bg-muted-foreground",
  "in-progress": "bg-[var(--node-in-progress)]",
  success: "bg-[var(--node-success)]",
  failed: "bg-[var(--node-failed)]",
}

function CyberNodeComponent({ data, selected }: NodeProps) {
  const nodeData = data as unknown as CyberNodeData

  return (
    <div
      className={cn(
        "min-w-[140px] rounded-lg border-2 px-4 py-3 transition-all duration-200 animate-float",
        statusStyles[nodeData.status],
        selected && "ring-2 ring-primary ring-offset-2 ring-offset-background"
      )}
      style={{
        animationDelay: `${Math.random() * 2}s`,
      }}
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
