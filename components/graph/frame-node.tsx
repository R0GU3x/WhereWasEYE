"use client"

import { memo, useCallback, useEffect, useRef } from "react"
import { Handle, Position, useReactFlow, type NodeProps } from "@xyflow/react"
import { cn } from "@/lib/utils"

export interface FrameNodeData extends Record<string, unknown> {
  label: string
  frameWidth: number
  frameHeight: number
  memberIds: string[]
}

type ResizeDirection = "n" | "e" | "s" | "w" | "ne" | "se" | "sw" | "nw"

function FrameNodeComponent({ data, selected, id }: NodeProps) {
  const frame = data as unknown as FrameNodeData
  const { getZoom } = useReactFlow()
  const resizeRef = useRef<{ direction: ResizeDirection; startX: number; startY: number; x: number; y: number; width: number; height: number } | null>(null)

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      window.dispatchEvent(new CustomEvent("wherewaseye:frame-geometry", { detail: { id } }))
    })
    return () => cancelAnimationFrame(frame)
  }, [frame.frameHeight, frame.frameWidth, id])

  const finishResize = useCallback(() => {
    if (!resizeRef.current) return
    window.dispatchEvent(new CustomEvent("wherewaseye:frame-resize-end", { detail: { id } }))
    resizeRef.current = null
    window.removeEventListener("pointermove", moveResize)
    window.removeEventListener("pointerup", finishResize)
  }, [id])

  const moveResize = useCallback((event: PointerEvent) => {
    const resize = resizeRef.current
    if (!resize) return
    const scale = Math.max(getZoom(), 0.01)
    const dx = (event.clientX - resize.startX) / scale
    const dy = (event.clientY - resize.startY) / scale
    const minWidth = 160
    const minHeight = 100
    let x = resize.x
    let y = resize.y
    let width = resize.width
    let height = resize.height
    if (resize.direction.includes("e")) width = Math.max(minWidth, resize.width + dx)
    if (resize.direction.includes("s")) height = Math.max(minHeight, resize.height + dy)
    if (resize.direction.includes("w")) { width = Math.max(minWidth, resize.width - dx); x = resize.x + resize.width - width }
    if (resize.direction.includes("n")) { height = Math.max(minHeight, resize.height - dy); y = resize.y + resize.height - height }
    window.dispatchEvent(new CustomEvent("wherewaseye:frame-resize", { detail: { id, dx: x, dy: y, width, height } }))
  }, [getZoom, id])

  const startResize = useCallback((event: React.PointerEvent<HTMLDivElement>, direction: ResizeDirection) => {
    event.preventDefault()
    event.stopPropagation()
    resizeRef.current = { direction, startX: event.clientX, startY: event.clientY, x: 0, y: 0, width: frame.frameWidth, height: frame.frameHeight }
    window.dispatchEvent(new CustomEvent("wherewaseye:frame-resize-start", { detail: { id } }))
    window.addEventListener("pointermove", moveResize)
    window.addEventListener("pointerup", finishResize)
  }, [finishResize, frame.frameHeight, frame.frameWidth, id, moveResize])

  const resizeClasses: Record<ResizeDirection, string> = {
    n: "left-1/2 top-0 h-2 w-8 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize",
    e: "right-0 top-1/2 h-8 w-2 -translate-y-1/2 cursor-ew-resize",
    s: "bottom-0 left-1/2 h-2 w-8 -translate-x-1/2 translate-y-1/2 cursor-ns-resize",
    w: "left-0 top-1/2 h-8 w-2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize",
    ne: "right-0 top-0 h-2.5 w-2.5 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize",
    se: "right-0 bottom-0 h-2.5 w-2.5 translate-x-1/2 translate-y-1/2 cursor-nwse-resize",
    sw: "left-0 bottom-0 h-2.5 w-2.5 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize",
    nw: "left-0 top-0 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize",
  }

  return (
    <div
      className={cn(
        "relative rounded-xl border border-dashed border-slate-400/45 bg-slate-400/[0.025] shadow-[inset_0_0_28px_rgba(148,163,184,0.025)] before:pointer-events-none before:absolute before:inset-0 before:rounded-xl before:border before:border-slate-300/10 before:content-['']",
        selected && "ring-1 ring-slate-300/70"
      )}
      style={{ width: frame.frameWidth, height: frame.frameHeight }}
    >
      {selected && (
        <div className="pointer-events-none absolute -inset-1 z-20">
          {(["n", "e", "s", "w", "ne", "se", "sw", "nw"] as ResizeDirection[]).map((direction) => (
            <div
              key={direction}
              onPointerDown={(event) => startResize(event, direction)}
              className={`pointer-events-auto absolute rounded-sm border border-slate-300/80 bg-background ${resizeClasses[direction]}`}
            />
          ))}
        </div>
      )}
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
