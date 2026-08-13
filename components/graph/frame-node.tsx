"use client"

import { memo, useCallback, useLayoutEffect, useRef, useState } from "react"
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
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(frame.label)
  const [labelWidth, setLabelWidth] = useState(44)
  const labelMeasureRef = useRef<HTMLSpanElement>(null)

  useLayoutEffect(() => {
    if (!editing || !labelMeasureRef.current) return
    const nextWidth = Math.max(8, Math.ceil(labelMeasureRef.current.getBoundingClientRect().width + 4))
    setLabelWidth((current) => current === nextWidth ? current : nextWidth)
  }, [draft, editing])

  const commitLabel = useCallback(() => {
    window.dispatchEvent(new CustomEvent("wherewaseye:frame-label", { detail: { id, label: draft } }))
    setEditing(false)
  }, [draft, id])
  const onResizeEnd = useCallback((_event: unknown, params: { width: number; height: number }) => {
    window.dispatchEvent(new CustomEvent("wherewaseye:frame-resize-end", { detail: { id, width: params.width, height: params.height } }))
  }, [id])

  return (
    <div
      className={cn(
        "relative rounded-xl border border-dashed border-slate-400/45 bg-slate-400/[0.025] shadow-[inset_0_0_28px_rgba(148,163,184,0.025)] before:pointer-events-none before:absolute before:inset-0 before:rounded-xl before:border before:border-slate-300/10 before:content-['']",
        selected && "ring-1 ring-slate-300/70"
      )}
      style={{ width: "100%", height: "100%" }}
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
        {editing ? (
          <>
          <input
            autoFocus
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commitLabel}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing || event.keyCode === 229) return
              if (event.key === "Enter") commitLabel()
              if (event.key === "Escape") {
                setDraft(frame.label)
                setEditing(false)
              }
            }}
            onPointerDown={(event) => event.stopPropagation()}
            style={{ width: `${labelWidth}px` }}
            className="pointer-events-auto border-0 border-b border-slate-300/60 bg-transparent px-0 py-0.5 font-mono text-[10px] uppercase tracking-[0.24em] text-slate-300/90 outline-none focus:border-slate-300"
            aria-label="Frame label"
          />
          <span ref={labelMeasureRef} aria-hidden="true" className="pointer-events-none absolute -z-10 whitespace-pre font-mono text-[10px] uppercase tracking-[0.24em] opacity-0">
            {draft || " "}
          </span>
          </>
        ) : (
          <span
            onDoubleClick={(event) => {
              event.stopPropagation()
              setDraft(frame.label)
              setEditing(true)
            }}
            className="pointer-events-auto cursor-text font-mono text-[10px] uppercase tracking-[0.24em] text-slate-300/75"
          >
            {frame.label || "Frame"}
          </span>
        )}
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
