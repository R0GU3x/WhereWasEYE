import { useState, useCallback } from "react"
import { exportSnapshot, type SnapshotTheme, type ExportFormat, type SnapshotOptions } from "@/lib/snapshot-utils"

interface UseSnapshotReturn {
  isExporting: boolean
  error: string | null
  exportSnapshot: (container: HTMLElement, theme: SnapshotTheme, format: ExportFormat, transparent: boolean, selectedNodesOnly: boolean) => Promise<void>
}

export function useSnapshot(): UseSnapshotReturn {
  const [isExporting, setIsExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleExport = useCallback(
    async (container: HTMLElement, theme: SnapshotTheme, format: ExportFormat, transparent: boolean, selectedNodesOnly: boolean) => {
      setIsExporting(true)
      setError(null)

      try {
        const options: SnapshotOptions = {
          theme,
          format,
          transparent,
          selectedNodesOnly,
        }
        await exportSnapshot(container, options)
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error occurred"
        setError(message)
        console.error("[v0] Export error:", err)
      } finally {
        setIsExporting(false)
      }
    },
    []
  )

  return {
    isExporting,
    error,
    exportSnapshot: handleExport,
  }
}
