"use client"

import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react"
import { Check, ChevronDown, ChevronUp, FolderKanban, GripVertical, Pencil, Plus, Trash2, X } from "lucide-react"

export interface WorkspaceItem {
  id: string
  name: string
}

interface WorkspacePanelProps {
  workspaces: WorkspaceItem[]
  activeWorkspaceId: string
  onSelect: (id: string) => void
  onCreate: (name: string) => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
  onReorder: (orderedIds: string[]) => void
}

const iconButtonClass = "flex size-7 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-35"

export function WorkspacePanel({
  workspaces,
  activeWorkspaceId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  onReorder,
}: WorkspacePanelProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [newName, setNewName] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState("")
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOrder, setDragOrder] = useState<string[] | null>(null)
  const [hoveredWorkspaceId, setHoveredWorkspaceId] = useState<string | null>(null)
  const panelZoneRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef(new Map<string, HTMLLIElement>())
  const previousPositions = useRef(new Map<string, number>())

  useLayoutEffect(() => {
    if (!dragOrder) return
    const animations: Array<{ element: HTMLLIElement; offset: number }> = []
    for (const id of dragOrder) {
      const element = itemRefs.current.get(id)
      const previousTop = previousPositions.current.get(id)
      if (!element || previousTop === undefined) continue
      const offset = previousTop - element.getBoundingClientRect().top
      if (Math.abs(offset) > 1) animations.push({ element, offset })
    }
    for (const { element, offset } of animations) {
      element.style.transition = "none"
      element.style.transform = `translateY(${offset}px)`
      element.getBoundingClientRect()
      requestAnimationFrame(() => {
        element.style.transition = "transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1)"
        element.style.transform = ""
      })
    }
    previousPositions.current.clear()
  }, [dragOrder])

  useEffect(() => {
    if (!isOpen) return
    const handleOutsidePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !panelZoneRef.current?.contains(event.target)) setIsOpen(false)
    }
    document.addEventListener("pointerdown", handleOutsidePointerDown)
    return () => document.removeEventListener("pointerdown", handleOutsidePointerDown)
  }, [isOpen])

  const visibleWorkspaces = dragOrder
    ? dragOrder.map((id) => workspaces.find((workspace) => workspace.id === id)).filter((workspace): workspace is WorkspaceItem => Boolean(workspace))
    : workspaces

  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId)

  function submitNewWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = newName.trim()
    if (!name) return
    onCreate(name)
    setNewName("")
    setIsCreating(false)
  }

  function submitRename(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault()
    const name = editingName.trim()
    if (!name) return
    onRename(id, name)
    setEditingId(null)
  }

  function moveWorkspace(id: string, direction: -1 | 1) {
    const index = workspaces.findIndex((workspace) => workspace.id === id)
    const targetIndex = index + direction
    if (index < 0 || targetIndex < 0 || targetIndex >= workspaces.length) return
    const reordered = [...workspaces]
    ;[reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]]
    onReorder(reordered.map((workspace) => workspace.id))
  }

  function moveDraggedWorkspace(targetId: string) {
    if (!draggedId || draggedId === targetId) return
    const current = dragOrder ?? workspaces.map((workspace) => workspace.id)
    const sourceIndex = current.indexOf(draggedId)
    const targetIndex = current.indexOf(targetId)
    if (sourceIndex < 0 || targetIndex < 0) return
    const reordered = [...current]
    reordered.splice(sourceIndex, 1)
    reordered.splice(targetIndex, 0, draggedId)
    previousPositions.current = new Map(visibleWorkspaces.map((workspace) => [
      workspace.id,
      itemRefs.current.get(workspace.id)?.getBoundingClientRect().top ?? 0,
    ]))
    setDragOrder(reordered)
  }

  function finishWorkspaceDrag() {
    if (dragOrder) onReorder(dragOrder)
    setDraggedId(null)
    setDragOrder(null)
  }

  return (
    <div ref={panelZoneRef} className="absolute left-4 top-4 z-30 w-[min(19rem,calc(100vw-2rem))]">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls="workspace-panel"
        onClick={() => setIsOpen((open) => !open)}
        className="flex max-w-full items-center gap-2 rounded-lg border border-border bg-card/90 px-3 py-2 font-mono text-xs text-foreground shadow-lg backdrop-blur-md transition-colors hover:border-primary/50 hover:bg-card"
      >
        <FolderKanban className="size-4 shrink-0 text-primary" aria-hidden="true" />
        <span className="max-w-52 truncate">{activeWorkspace?.name ?? "Workspace"}</span>
        <ChevronDown className={`size-4 shrink-0 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>

      <section
        id="workspace-panel"
        aria-label="Workspace management"
        aria-hidden={!isOpen}
        inert={!isOpen}
        className={`mt-2 rounded-xl border border-border bg-card/95 shadow-xl backdrop-blur-md transition-all duration-200 ease-out ${isOpen ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-1 opacity-0"}`}
      >
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h2 className="font-mono text-sm font-semibold text-foreground">Workspaces</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Separate graph environments</p>
          </div>
          <button
            type="button"
            aria-label="Create workspace"
            onClick={() => setIsCreating((creating) => !creating)}
            className="flex size-8 items-center justify-center rounded-md border border-primary/40 bg-primary/10 text-primary transition-colors hover:bg-primary/20"
          >
            <Plus className="size-4" aria-hidden="true" />
          </button>
        </header>

        {isCreating && (
          <form onSubmit={submitNewWorkspace} className="flex gap-2 border-b border-border p-3">
            <label className="sr-only" htmlFor="new-workspace-name">New workspace name</label>
            <input
              autoFocus
              id="new-workspace-name"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              maxLength={50}
              placeholder="Workspace name"
              className="min-w-0 flex-1 rounded-md border border-border bg-input px-2.5 py-2 font-mono text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary"
            />
            <button type="submit" disabled={!newName.trim()} className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground transition-opacity disabled:opacity-40" aria-label="Save workspace">
              <Check className="size-4" aria-hidden="true" />
            </button>
            <button type="button" onClick={() => { setIsCreating(false); setNewName("") }} className={iconButtonClass} aria-label="Cancel creating workspace">
              <X className="size-4" aria-hidden="true" />
            </button>
          </form>
        )}

        <ul className="max-h-[min(55vh,24rem)] overflow-y-auto p-2">
          {visibleWorkspaces.map((workspace, index) => (
            <li
              key={workspace.id}
              onMouseEnter={() => setHoveredWorkspaceId(workspace.id)}
              onMouseLeave={() => setHoveredWorkspaceId(null)}
              onFocusCapture={() => setHoveredWorkspaceId(workspace.id)}
              onBlurCapture={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setHoveredWorkspaceId(null)
              }}
              ref={(element) => {
                if (element) itemRefs.current.set(workspace.id, element)
                else itemRefs.current.delete(workspace.id)
              }}
              draggable={editingId !== workspace.id}
              onDragStart={(event) => {
                setDraggedId(workspace.id)
                setDragOrder(workspaces.map((item) => item.id))
                event.dataTransfer.effectAllowed = "move"
                event.dataTransfer.setData("text/plain", workspace.id)
              }}
              onDragEnter={(event) => { event.preventDefault(); moveDraggedWorkspace(workspace.id) }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => { event.preventDefault(); finishWorkspaceDrag() }}
              onDragEnd={finishWorkspaceDrag}
              className={`group relative mb-1 rounded-lg transition-all duration-200 ease-out last:mb-0 ${draggedId === workspace.id ? "scale-[1.02] opacity-65 shadow-lg" : ""} ${workspace.id === activeWorkspaceId ? "bg-primary/10" : "hover:bg-muted/60"}`}
            >
              <div className="flex min-h-11 items-center gap-1 px-1.5">
                <span className="cursor-grab px-1 text-muted-foreground/60" aria-hidden="true">
                  <GripVertical className="size-4" />
                </span>
                {editingId === workspace.id ? (
                  <form onSubmit={(event) => submitRename(event, workspace.id)} className="flex min-w-0 flex-1 items-center gap-1">
                    <label className="sr-only" htmlFor={`rename-workspace-${workspace.id}`}>Rename {workspace.name}</label>
                    <input
                      autoFocus
                      id={`rename-workspace-${workspace.id}`}
                      value={editingName}
                      onChange={(event) => setEditingName(event.target.value)}
                      maxLength={50}
                      className="min-w-0 flex-1 rounded border border-primary bg-input px-2 py-1.5 font-mono text-xs text-foreground outline-none"
                    />
                    <button type="submit" disabled={!editingName.trim()} className={iconButtonClass} aria-label="Save workspace name">
                      <Check className="size-4" aria-hidden="true" />
                    </button>
                    <button type="button" onClick={() => setEditingId(null)} className={iconButtonClass} aria-label="Cancel rename">
                      <X className="size-4" aria-hidden="true" />
                    </button>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => onSelect(workspace.id)}
                    className="min-w-0 flex-1 truncate py-2 text-left font-mono text-xs text-foreground"
                    aria-pressed={workspace.id === activeWorkspaceId}
                  >
                    {workspace.name}
                  </button>
                )}
                <span role="tooltip" className={`pointer-events-none absolute left-10 top-full z-50 mt-1 max-w-[min(18rem,calc(100vw-4rem))] break-words whitespace-normal rounded-md border border-primary/30 bg-popover px-2.5 py-1.5 font-mono text-[11px] text-popover-foreground shadow-lg transition-all duration-150 ${hoveredWorkspaceId === workspace.id ? "translate-y-0.5 opacity-100" : "translate-y-0 opacity-0"}`}>
                  {workspace.name}
                </span>
                {editingId !== workspace.id && (
                  <>
                    <button type="button" className={iconButtonClass} disabled={index === 0} onClick={() => moveWorkspace(workspace.id, -1)} aria-label={`Move ${workspace.name} up`}>
                      <ChevronUp className="size-4" aria-hidden="true" />
                    </button>
                    <button type="button" className={iconButtonClass} disabled={index === workspaces.length - 1} onClick={() => moveWorkspace(workspace.id, 1)} aria-label={`Move ${workspace.name} down`}>
                      <ChevronDown className="size-4" aria-hidden="true" />
                    </button>
                    <button type="button" className={iconButtonClass} onClick={() => { setEditingId(workspace.id); setEditingName(workspace.name); setConfirmDeleteId(null) }} aria-label={`Rename ${workspace.name}`}>
                      <Pencil className="size-3.5" aria-hidden="true" />
                    </button>
                    {workspaces.length > 1 && (
                      <button type="button" className={`${iconButtonClass} hover:bg-destructive/10 hover:text-destructive`} onClick={() => setConfirmDeleteId(confirmDeleteId === workspace.id ? null : workspace.id)} aria-label={`Delete ${workspace.name}`}>
                        <Trash2 className="size-3.5" aria-hidden="true" />
                      </button>
                    )}
                  </>
                )}
              </div>
              {confirmDeleteId === workspace.id && (
                <div className="flex items-center justify-between gap-2 border-t border-border/70 px-3 py-2">
                  <p className="text-xs text-muted-foreground">Delete this workspace and its graph?</p>
                  <div className="flex shrink-0 gap-1">
                    <button type="button" onClick={() => setConfirmDeleteId(null)} className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted">Cancel</button>
                    <button type="button" onClick={() => { onDelete(workspace.id); setConfirmDeleteId(null) }} className="rounded bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/20">Delete</button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
        <footer className="border-t border-border px-3 py-2 text-center font-mono text-[10px] text-muted-foreground">
          Drag to reorder · {workspaces.length} {workspaces.length === 1 ? "workspace" : "workspaces"}
        </footer>
      </section>
    </div>
  )
}
