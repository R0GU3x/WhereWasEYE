"use client"

import { useState } from "react"
import { Download, X } from "lucide-react"
import type { WorkspaceItem } from "./workspace-panel"

interface WorkspaceExportDialogProps {
  workspaces: WorkspaceItem[]
  onClose: () => void
  onExport: (scope: "current" | "selected" | "all", selectedIds: string[]) => void
}

export function WorkspaceExportDialog({ workspaces, onClose, onExport }: WorkspaceExportDialogProps) {
  const [scope, setScope] = useState<"current" | "selected" | "all">("current")
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const toggleWorkspace = (id: string) => setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  const allSelected = workspaces.length > 0 && selectedIds.length === workspaces.length

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section role="dialog" aria-modal="true" aria-labelledby="workspace-export-title" className="w-full max-w-md rounded-xl border border-border bg-card p-5 text-foreground shadow-2xl">
        <header className="mb-4 flex items-start justify-between">
          <div>
            <h2 id="workspace-export-title" className="font-mono text-sm font-semibold">Export workspaces</h2>
            <p className="mt-1 text-xs text-muted-foreground">Download graph data and workspace settings as JSON.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close export dialog" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><X className="size-4" /></button>
        </header>
        <fieldset className="flex flex-col gap-2">
          <legend className="sr-only">Workspace export scope</legend>
          {([
            ["current", "Export current workspace"],
            ["selected", "Export selected workspaces"],
            ["all", "Export all workspaces"],
          ] as const).map(([value, label]) => (
            <label key={value} className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-xs transition-colors ${scope === value ? "border-primary/50 bg-primary/10" : "border-border hover:bg-muted/50"}`}>
              <input type="radio" name="workspace-export-scope" value={value} checked={scope === value} onChange={() => setScope(value)} className="accent-primary" />
              <span>{label}</span>
            </label>
          ))}
        </fieldset>
        {scope === "selected" && (
          <div className="mt-3 rounded-lg border border-border p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="font-mono text-[11px] text-muted-foreground">Select workspaces</p>
              <button type="button" onClick={() => setSelectedIds(allSelected ? [] : workspaces.map((item) => item.id))} className="text-[11px] text-primary hover:underline">{allSelected ? "Deselect all" : "Select all"}</button>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {workspaces.map((workspace) => (
                <label key={workspace.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1.5 text-xs hover:bg-muted/50">
                  <input type="checkbox" checked={selectedIds.includes(workspace.id)} onChange={() => toggleWorkspace(workspace.id)} className="accent-primary" />
                  <span className="truncate">{workspace.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}
        <footer className="mt-5 flex items-center justify-between gap-3">
          <p aria-live="polite" className="text-[11px] text-muted-foreground">{scope === "selected" ? `${selectedIds.length} selected` : `${workspaces.length} available`}</p>
          <button type="button" disabled={scope === "selected" && selectedIds.length === 0} onClick={() => onExport(scope, selectedIds)} className="flex items-center gap-2 rounded-md bg-primary px-3 py-2 font-mono text-xs text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">
            <Download className="size-3.5" aria-hidden="true" /> Export JSON
          </button>
        </footer>
      </section>
    </div>
  )
}
