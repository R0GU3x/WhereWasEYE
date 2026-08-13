"use client"

import { memo, useCallback } from "react"
import { Handle, NodeResizer, Position, type NodeProps } from "@xyflow/react"
import { cn } from "@/lib/utils"

export interface FrameNodeData extends Record<string, unknown> {
  label: string
  frameWidth: number
  frameHeight: number
  memberIds: string[]
}

function FrameNodeComponent({ data, selected, id }: NodeProps) {
  const frame = data as unknown as FrameNodeData
  const onResizeEnd = useCallback((_event: unknown, params: { width: number; height: number }) => {
    window.dispatchEvent(new CustomEvent("wherewaseye:frame-resize-end", { detail: { id, width: params.width, height: params.height } }))
  }, [id])

  return (
    <div
      className={cn(
        "relative rounded-xl border border-dashed border-slate-400/45 bg-slate-400/[0.025] shadow-[inset_0_0_28px_rgba(148,163,184,0.025)] before:pointer-events-none before:absolute before:inset-0 before:rounded-xl before:border before:border-slate-300/10 before:content-['']",
        selected && "ring-1 ring-slate-300/70"
      )}
      style={{ width: frame.frameWidth, height: frame.frameHeight }}
    >
      <NodeResizer
        isVisible={Boolean(selected)}
        onResizeEnd={onResizeEnd}
        minWidth={160}
        minHeight={100}
        lineClassName="!border-slate-300/60"
        handleClassName="!h-2.5 !w-2.5 !border-slate-300 !bg-background"
      />
      <div className="pointer-events-none absolute left-4 top-3 z-10 flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-slate-300 shadow-[0_0_8px_rgba(203,213,225,0.55)]" />
        <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-slate-300/75">
          {frame.label || "Frame"}
        </span>
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
