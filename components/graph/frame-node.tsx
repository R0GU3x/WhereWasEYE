"use client"

import { memo } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import { cn } from "@/lib/utils"

export interface FrameNodeData extends Record<string, unknown> {
  label: string
  frameWidth: number
  frameHeight: number
  memberIds: string[]
}

function FrameNodeComponent({ data, selected }: NodeProps) {
  const frame = data as unknown as FrameNodeData

  return (
    <div
      className={cn(
        "relative rounded-xl border border-dashed border-primary/45 bg-primary/[0.035] shadow-[inset_0_0_28px_rgba(80,160,255,0.035)]",
        selected && "ring-1 ring-primary/70"
      )}
      style={{ width: frame.frameWidth, height: frame.frameHeight }}
    >
      <div className="pointer-events-none absolute left-4 top-3 font-mono text-[10px] uppercase tracking-[0.24em] text-primary/70">
        {frame.label || "Frame"}
      </div>
      {(
        [
          ["top", Position.Top],
          ["right", Position.Right],
          ["bottom", Position.Bottom],
          ["left", Position.Left],
        ] as const
      ).map(([position, handlePosition]) => (
        <div key={position} className="pointer-events-none contents">
          <Handle id={`${position}-target`} type="target" position={handlePosition} className="pointer-events-auto !h-6 !w-6 !border-0 !bg-transparent" />
          <Handle id={`${position}-source`} type="source" position={handlePosition} className="pointer-events-auto !h-6 !w-6 !border-0 !bg-transparent" />
        </div>
      ))}
    </div>
  )
}

export const FrameNode = memo(FrameNodeComponent)
FrameNode.displayName = "FrameNode"
