"use client"

import { useState } from "react"
import { Download, Loader } from "lucide-react"
import { useSnapshot } from "@/lib/use-snapshot"
import type { SnapshotTheme, ExportFormat } from "@/lib/snapshot-utils"

interface SnapshotToolbarProps {
  containerRef: React.RefObject<HTMLDivElement>
  selectedNodesOnly: boolean
}

export function SnapshotToolbar({ containerRef, selectedNodesOnly }: SnapshotToolbarProps) {
  const [showMenu, setShowMenu] = useState(false)
  const [selectedTheme, setSelectedTheme] = useState<SnapshotTheme>("dark")
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>("png")
  const [transparent, setTransparent] = useState(false)
  const { isExporting, error, exportSnapshot } = useSnapshot()

  const handleExport = async () => {
    if (!containerRef.current) return

    try {
      await exportSnapshot(containerRef.current, selectedTheme, selectedFormat, transparent, selectedNodesOnly)
      setShowMenu(false)
    } catch (err) {
      console.error("[v0] Export failed:", err)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        disabled={isExporting}
        className="p-2 hover:bg-muted rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="Export snapshot"
      >
        {isExporting ? (
          <Loader className="w-4 h-4 animate-spin" />
        ) : (
          <Download className="w-4 h-4" />
        )}
      </button>

      {showMenu && (
        <div className="absolute top-full right-0 mt-2 bg-card border border-border rounded-lg shadow-lg p-4 z-50 min-w-80">
          <h3 className="text-sm font-semibold text-foreground mb-4">Export Snapshot</h3>

          {/* Theme Selection */}
          <div className="mb-4">
            <label className="text-xs font-medium text-muted-foreground mb-2 block">Theme</label>
            <div className="flex gap-2">
              {(["light", "dark"] as const).map((theme) => (
                <button
                  key={theme}
                  onClick={() => setSelectedTheme(theme)}
                  className={`flex-1 py-2 px-3 rounded text-xs font-medium transition-colors ${
                    selectedTheme === theme
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {theme.charAt(0).toUpperCase() + theme.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Format Selection */}
          <div className="mb-4">
            <label className="text-xs font-medium text-muted-foreground mb-2 block">Format</label>
            <select
              value={selectedFormat}
              onChange={(e) => setSelectedFormat(e.target.value as ExportFormat)}
              className="w-full px-3 py-2 rounded border border-border bg-muted text-foreground text-xs"
            >
              <option value="png">PNG</option>
              <option value="svg">SVG</option>
            </select>
          </div>

          {/* Transparent Background */}
          <div className="mb-4 flex items-center gap-2">
            <input
              type="checkbox"
              id="transparent"
              checked={transparent}
              onChange={(e) => setTransparent(e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <label htmlFor="transparent" className="text-xs font-medium text-muted-foreground cursor-pointer">
              Transparent background
            </label>
          </div>

          {/* Info */}
          <div className="mb-4 p-2 bg-muted rounded text-xs text-muted-foreground">
            {selectedNodesOnly ? "Selected nodes only" : "Full canvas"}
          </div>

          {error && (
            <div className="mb-4 p-2 bg-destructive/10 rounded text-xs text-destructive">{error}</div>
          )}

          {/* Export Button */}
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="w-full py-2 px-3 bg-primary text-primary-foreground rounded text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExporting ? "Exporting..." : "Export"}
          </button>
        </div>
      )}
    </div>
  )
}
