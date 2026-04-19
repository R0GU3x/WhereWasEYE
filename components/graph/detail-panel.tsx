"use client"

import { useEffect, useRef, useState, useMemo } from "react"
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

// Simple markdown parser for basic formatting
function parseMarkdown(text: string) {
  const lines = text.split('\n')
  const elements: (string | { type: string; content: string })[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Headers
    if (line.startsWith('### ')) {
      elements.push({ type: 'h3', content: line.substring(4) })
    } else if (line.startsWith('## ')) {
      elements.push({ type: 'h2', content: line.substring(3) })
    } else if (line.startsWith('# ')) {
      elements.push({ type: 'h1', content: line.substring(2) })
    }
    // Bold
    else if (line.includes('**')) {
      elements.push(line)
    }
    // Italic
    else if (line.includes('*')) {
      elements.push(line)
    }
    // Code blocks
    else if (line.startsWith('`')) {
      elements.push({ type: 'code', content: line.replace(/`/g, '') })
    }
    // Lists
    else if (line.startsWith('- ')) {
      elements.push({ type: 'li', content: line.substring(2) })
    }
    // Regular text
    else if (line.trim()) {
      elements.push(line)
    }
  }

  return elements
}

function renderMarkdownPreview(text: string) {
  const elements = parseMarkdown(text)
  
  return elements.map((el, idx) => {
    if (typeof el === 'string') {
      let content = el
      // Bold text
      content = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // Italic text
      content = content.replace(/\*(.*?)\*/g, '<em>$1</em>')
      // Inline code
      content = content.replace(/`(.*?)`/g, '<code>$1</code>')
      
      return (
        <p key={idx} className="mb-2 text-sm text-foreground" dangerouslySetInnerHTML={{ __html: content }} />
      )
    }

    switch (el.type) {
      case 'h1':
        return (
          <h1 key={idx} className="mb-2 text-lg font-bold text-foreground">
            {el.content}
          </h1>
        )
      case 'h2':
        return (
          <h2 key={idx} className="mb-2 text-base font-bold text-foreground">
            {el.content}
          </h2>
        )
      case 'h3':
        return (
          <h3 key={idx} className="mb-2 text-sm font-semibold text-foreground">
            {el.content}
          </h3>
        )
      case 'code':
        return (
          <code key={idx} className="mb-2 block rounded bg-muted px-2 py-1 font-mono text-xs text-foreground">
            {el.content}
          </code>
        )
      case 'li':
        return (
          <li key={idx} className="mb-1 ml-4 list-disc text-sm text-foreground">
            {el.content}
          </li>
        )
      default:
        return null
    }
  })
}

export function DetailPanel({ node, onClose, onUpdateNode }: DetailPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [showPreview, setShowPreview] = useState(false)
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
          <div className="mb-2 flex items-center justify-between">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Notes (Markdown Supported)
            </label>
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="rounded px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
            >
              {showPreview ? 'Edit' : 'Preview'}
            </button>
          </div>
          {showPreview ? (
            <div className="rounded border border-border bg-muted/30 p-3 text-sm">
              {data.notes ? (
                <div className="space-y-2">
                  {renderMarkdownPreview(data.notes)}
                </div>
              ) : (
                <p className="text-muted-foreground">No notes yet</p>
              )}
            </div>
          ) : (
            <textarea
              value={data.notes}
              onChange={(e) => onUpdateNode(node.id, { notes: e.target.value })}
              placeholder="Add notes about this step... Supports **bold**, *italic*, `code`, # Headers, - Lists"
              rows={5}
              className="w-full resize-none rounded border border-border bg-input px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          )}
        </div>
      </div>
    </div>
  )
}
