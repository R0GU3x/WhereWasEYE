"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { X, Download, Sun, Moon, Image, FileCode, Check, Copy } from "lucide-react"
import type { Node, Edge } from "@xyflow/react"
import type { CyberNodeData, NodeStatus } from "./cyber-node"

interface SnapshotModalProps {
  nodes: Node<CyberNodeData>[]
  edges: Edge[]
  selectedNodeIds?: Set<string>
  onClose: () => void
  onExport?: () => void
}

type ThemeMode = "light" | "dark"
type ExportFormat = "png" | "svg"

const LIGHT_THEME = {
  background: "#f8fafc",
  nodeBackground: "#ffffff",
  nodeBorder: "#e2e8f0",
  nodeText: "#1e293b",
  nodeSubtext: "#64748b",
  edgeColor: "#94a3b8",
  statusColors: {
    default: "#94a3b8",
    "in-progress": "#3b82f6",
    pending: "#f59e0b",
    success: "#22c55e",
    failed: "#ef4444",
    interesting: "#a855f7",
  } as Record<NodeStatus, string>,
}

const DARK_THEME = {
  background: "#0f172a",
  nodeBackground: "#1e293b",
  nodeBorder: "#334155",
  nodeText: "#f1f5f9",
  nodeSubtext: "#94a3b8",
  edgeColor: "#475569",
  statusColors: {
    default: "#64748b",
    "in-progress": "#60a5fa",
    pending: "#fbbf24",
    success: "#4ade80",
    failed: "#f87171",
    interesting: "#c084fc",
  } as Record<NodeStatus, string>,
}

export function SnapshotModal({
  nodes,
  edges,
  selectedNodeIds,
  onClose,
  onExport,
}: SnapshotModalProps) {
  const [themeMode, setThemeMode] = useState<ThemeMode>("dark")
  const [format, setFormat] = useState<ExportFormat>("png")
  const [transparent, setTransparent] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [copiedFormat, setCopiedFormat] = useState<ExportFormat | null>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handleKeyDown)
    modalRef.current?.focus()
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [onClose])

  const exportNodes = selectedNodeIds && selectedNodeIds.size > 0
    ? nodes.filter((n) => selectedNodeIds.has(n.id))
    : nodes

  const exportEdges = selectedNodeIds && selectedNodeIds.size > 0
    ? edges.filter((e) => selectedNodeIds.has(e.source) && selectedNodeIds.has(e.target))
    : edges

  const generateSVG = useCallback((): string => {
    const theme = themeMode === "light" ? LIGHT_THEME : DARK_THEME
    const padding = 60
    const nodeWidth = 140
    const nodeHeight = 50

    if (exportNodes.length === 0) {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200">
        <text x="200" y="100" text-anchor="middle" fill="${theme.nodeText}" font-family="monospace">No nodes to export</text>
      </svg>`
    }

    const xs = exportNodes.map((n) => n.position.x)
    const ys = exportNodes.map((n) => n.position.y)
    const minX = Math.min(...xs) - padding
    const maxX = Math.max(...xs) + nodeWidth + padding
    const minY = Math.min(...ys) - padding
    const maxY = Math.max(...ys) + nodeHeight + padding

    const width = maxX - minX
    const height = maxY - minY

    const nodePositions = new Map(exportNodes.map((n) => [n.id, n.position]))

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${minX} ${minY} ${width} ${height}">`

    if (!transparent) {
      svg += `<rect x="${minX}" y="${minY}" width="${width}" height="${height}" fill="${theme.background}"/>`
    }

    // Draw edges
    exportEdges.forEach((edge) => {
      const sourcePos = nodePositions.get(edge.source)
      const targetPos = nodePositions.get(edge.target)
      if (!sourcePos || !targetPos) return

      const x1 = sourcePos.x + nodeWidth / 2
      const y1 = sourcePos.y + nodeHeight
      const x2 = targetPos.x + nodeWidth / 2
      const y2 = targetPos.y

      svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${theme.edgeColor}" stroke-width="2" marker-end="url(#arrowhead)"/>`
    })

    // Arrow marker
    svg += `<defs><marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill="${theme.edgeColor}"/>
    </marker></defs>`

    // Draw nodes
    exportNodes.forEach((node) => {
      const data = node.data as CyberNodeData
      const x = node.position.x
      const y = node.position.y
      const statusColor = theme.statusColors[data.status] || theme.statusColors.default

      svg += `<g>
        <rect x="${x}" y="${y}" width="${nodeWidth}" height="${nodeHeight}" rx="8" ry="8" 
          fill="${theme.nodeBackground}" stroke="${statusColor}" stroke-width="2"/>
        <circle cx="${x + 16}" cy="${y + 20}" r="5" fill="${statusColor}"/>
        <text x="${x + 28}" y="${y + 25}" font-family="monospace" font-size="12" fill="${theme.nodeText}">${escapeXml(data.label)}</text>
        ${data.entityType ? `<text x="${x + 12}" y="${y + 42}" font-family="monospace" font-size="10" fill="${theme.nodeSubtext}">${escapeXml(data.entityType)}</text>` : ""}
      </g>`
    })

    svg += `</svg>`
    return svg
  }, [exportNodes, exportEdges, themeMode, transparent])

  const handleCopyToClipboard = useCallback(async () => {
    try {
      const svgString = generateSVG()
      const img = new window.Image()
      img.crossOrigin = "anonymous"

      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          const canvas = document.createElement("canvas")
          const scale = 2
          canvas.width = img.width * scale
          canvas.height = img.height * scale

          const ctx = canvas.getContext("2d")
          if (!ctx) {
            reject(new Error("Canvas context not available"))
            return
          }

          ctx.scale(scale, scale)

          if (!transparent) {
            const theme = themeMode === "light" ? LIGHT_THEME : DARK_THEME
            ctx.fillStyle = theme.background
            ctx.fillRect(0, 0, img.width, img.height)
          }

          ctx.drawImage(img, 0, 0)

          canvas.toBlob(
            async (blob) => {
              if (blob) {
                try {
                  const items = new ClipboardItem({ "image/png": blob })
                  await navigator.clipboard.write(items)
                  resolve()
                } catch (err) {
                  reject(err)
                }
              } else {
                reject(new Error("Failed to create blob"))
              }
            },
            "image/png",
            1.0
          )
        }
        img.onerror = reject
        img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgString)
      })

      setCopiedFormat(format)
      setTimeout(() => setCopiedFormat(null), 2000)
    } catch (err) {
      console.error("Copy failed:", err)
    }
  }, [format, generateSVG, themeMode, transparent])

  const handleExport = useCallback(async () => {
    setIsExporting(true)

    try {
      const svgString = generateSVG()

      if (format === "svg") {
        const blob = new Blob([svgString], { type: "image/svg+xml" })
        downloadBlob(blob, `canvas-snapshot-${Date.now()}.svg`)
      } else {
        const img = new window.Image()
        img.crossOrigin = "anonymous"

        await new Promise<void>((resolve, reject) => {
          img.onload = () => {
            const canvas = document.createElement("canvas")
            const scale = 2
            canvas.width = img.width * scale
            canvas.height = img.height * scale

            const ctx = canvas.getContext("2d")
            if (!ctx) {
              reject(new Error("Canvas context not available"))
              return
            }

            ctx.scale(scale, scale)

            if (!transparent) {
              const theme = themeMode === "light" ? LIGHT_THEME : DARK_THEME
              ctx.fillStyle = theme.background
              ctx.fillRect(0, 0, img.width, img.height)
            }

            ctx.drawImage(img, 0, 0)

            canvas.toBlob(
              (blob) => {
                if (blob) {
                  downloadBlob(blob, `canvas-snapshot-${Date.now()}.png`)
                  resolve()
                } else {
                  reject(new Error("Failed to create blob"))
                }
              },
              "image/png",
              1.0
            )
          }
          img.onerror = reject
          img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgString)
        })
      }

      onExport?.()
      onClose()
    } catch (err) {
      console.error("Export failed:", err)
    } finally {
      setIsExporting(false)
    }
  }, [format, generateSVG, themeMode, transparent, onClose, onExport])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div ref={modalRef} tabIndex={-1} className="relative w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl mx-4 outline-none">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <X size={18} />
        </button>

        <h2 className="mb-1 text-lg font-semibold text-foreground">Export Snapshot</h2>
        <p className="mb-6 text-sm text-muted-foreground">
          {selectedNodeIds && selectedNodeIds.size > 0
            ? `Exporting ${selectedNodeIds.size} selected node${selectedNodeIds.size !== 1 ? "s" : ""}`
            : `Exporting entire canvas (${nodes.length} nodes)`}
        </p>

        {/* Theme Selection */}
        <div className="mb-4">
          <label className="mb-2 block text-sm font-medium text-foreground">Theme</label>
          <div className="flex gap-2">
            <button
              onClick={() => setThemeMode("light")}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
                themeMode === "light"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:bg-muted"
              }`}
            >
              <Sun size={16} />
              Light
            </button>
            <button
              onClick={() => setThemeMode("dark")}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
                themeMode === "dark"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:bg-muted"
              }`}
            >
              <Moon size={16} />
              Dark
            </button>
          </div>
        </div>

        {/* Format Selection */}
        <div className="mb-4">
          <label className="mb-2 block text-sm font-medium text-foreground">Format</label>
          <div className="flex gap-2">
            <button
              onClick={() => setFormat("png")}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
                format === "png"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:bg-muted"
              }`}
            >
              <Image size={16} />
              PNG
            </button>
            <button
              onClick={() => setFormat("svg")}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
                format === "svg"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:bg-muted"
              }`}
            >
              <FileCode size={16} />
              SVG
            </button>
          </div>
        </div>

        {/* Transparent Background */}
        <div className="mb-6">
          <button
            onClick={() => setTransparent(!transparent)}
            className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
              transparent
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground hover:bg-muted"
            }`}
          >
            <span>Transparent Background</span>
            <div
              className={`flex h-5 w-5 items-center justify-center rounded border transition-colors ${
                transparent ? "border-primary bg-primary" : "border-muted-foreground"
              }`}
            >
              {transparent && <Check size={14} className="text-primary-foreground" />}
            </div>
          </button>
        </div>

        {/* Copy and Export Buttons */}
        <div className="flex gap-2 w-full">
          <button
            onClick={handleCopyToClipboard}
            className="flex items-center justify-center gap-2 rounded-lg bg-secondary/20 px-4 py-3 font-medium text-secondary-foreground transition-colors hover:bg-secondary/30 border border-secondary/40 flex-1"
          >
            {copiedFormat === format ? (
              <>
                <Check size={16} className="text-green-500" />
                Copied!
              </>
            ) : (
              <>
                <Copy size={16} />
                Copy {format.toUpperCase()}
              </>
            )}
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 flex-1"
          >
            {isExporting ? (
              "Exporting..."
            ) : (
              <>
                <Download size={16} />
                Export {format.toUpperCase()}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
