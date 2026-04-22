"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import type { NodeStatus } from "./cyber-node"

interface ContextMenuProps {
  x: number
  y: number
  nodeId?: string
  edgeId?: string
  onClose: () => void
  onAddNode: (parentId?: string) => void
  onSetStatus: (nodeId: string, status: NodeStatus) => void
  onDeleteNode: (nodeId: string) => void
  onDeleteEdge?: (edgeId: string) => void
  onReverseEdge?: (edgeId: string) => void
  onClearCanvas?: () => void
  onSnapshot?: () => void
}

export function ContextMenu({
  x,
  y,
  nodeId,
  edgeId,
  onClose,
  onAddNode,
  onSetStatus,
  onDeleteNode,
  onDeleteEdge,
  onReverseEdge,
  onClearCanvas,
  onSnapshot,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ x, y })

  // Adjust position to keep menu within viewport
  useEffect(() => {
    if (!menuRef.current) return

    const menu = menuRef.current
    const menuRect = menu.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const padding = 8 // Padding from viewport edges

    let adjustedX = x
    let adjustedY = y

    // Check right edge
    if (x + menuRect.width > viewportWidth - padding) {
      adjustedX = x - menuRect.width
    }

    // Check left edge
    if (adjustedX < padding) {
      adjustedX = padding
    }

    // Check bottom edge
    if (y + menuRect.height > viewportHeight - padding) {
      adjustedY = y - menuRect.height
    }

    // Check top edge
    if (adjustedY < padding) {
      adjustedY = padding
    }

    setPosition({ x: adjustedX, y: adjustedY })
  }, [x, y])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose()
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("keydown", handleEscape)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleEscape)
    }
  }, [onClose])

  const menuItems = edgeId
    ? [
        {
          label: "Reverse Direction",
          icon: "⇄",
          action: () => onReverseEdge?.(edgeId),
        },
        { type: "separator" as const },
        {
          label: "Delete Edge",
          icon: "×",
          iconClass: "text-destructive",
          action: () => onDeleteEdge?.(edgeId),
          className: "text-destructive hover:bg-destructive/10",
        },
      ]
    : nodeId
    ? [
        {
          label: "Add Child Node",
          icon: "+",
          action: () => onAddNode(nodeId),
        },
        { type: "separator" as const },
        {
          label: "Default",
          icon: "○",
          iconClass: "text-muted-foreground",
          action: () => onSetStatus(nodeId, "default"),
        },
        {
          label: "In-Progress",
          icon: "●",
          iconClass: "text-[var(--node-in-progress)]",
          action: () => onSetStatus(nodeId, "in-progress"),
        },
        {
          label: "Pending",
          icon: "●",
          iconClass: "text-[var(--node-pending)]",
          action: () => onSetStatus(nodeId, "pending"),
        },
        {
          label: "Success",
          icon: "●",
          iconClass: "text-[var(--node-success)]",
          action: () => onSetStatus(nodeId, "success"),
        },
        {
          label: "Failed",
          icon: "●",
          iconClass: "text-[var(--node-failed)]",
          action: () => onSetStatus(nodeId, "failed"),
        },
        {
          label: "Interesting",
          icon: "●",
          iconClass: "text-[var(--node-interesting)]",
          action: () => onSetStatus(nodeId, "interesting"),
        },
        { type: "separator" as const },
        {
          label: "Delete Node",
          icon: "×",
          iconClass: "text-destructive",
          action: () => onDeleteNode(nodeId),
          className: "text-destructive hover:bg-destructive/10",
        },
      ]
    : [
        {
          label: "Add Node",
          icon: "+",
          action: () => onAddNode(),
        },
        {
          label: "Take Snapshot",
          icon: "📷",
          action: () => onSnapshot?.(),
        },
        { type: "separator" as const },
        {
          label: "Clear Canvas",
          icon: "⌫",
          iconClass: "text-destructive",
          action: () => onClearCanvas?.(),
          className: "text-destructive hover:bg-destructive/10",
        },
      ]

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[180px] rounded-lg border border-border bg-popover p-1 shadow-lg shadow-black/20 transition-opacity duration-100"
      style={{ left: position.x, top: position.y }}
    >
      {menuItems.map((item, i) =>
        item.type === "separator" ? (
          <div key={i} className="my-1 h-px bg-border" />
        ) : (
          <button
            key={i}
            className={cn(
              "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent",
              item.className
            )}
            onClick={() => {
              item.action()
              onClose()
            }}
          >
            <span className={cn("w-4 text-center font-mono", item.iconClass)}>
              {item.icon}
            </span>
            {item.label}
          </button>
        )
      )}
    </div>
  )
}
