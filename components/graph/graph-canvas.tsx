"use client"

import { useCallback, useState, useRef, useEffect } from "react"
import { CircleHelp, X, ChevronDown, ChevronUp } from "lucide-react"
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
  type NodeMouseHandler,
  BackgroundVariant,
  MarkerType,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"

import { CyberNode, type CyberNodeData, type NodeStatus } from "./cyber-node"
import { ContextMenu } from "./context-menu"
import { DetailPanel } from "./detail-panel"

const nodeTypes = {
  cyber: CyberNode,
}

const defaultEdgeOptions = {
  style: { stroke: "var(--border)", strokeWidth: 2 },
  markerEnd: {
    type: MarkerType.ArrowClosed,
    color: "var(--border)",
  },
  animated: true,
}

interface ContextMenuState {
  x: number
  y: number
  nodeId?: string
  edgeId?: string
}

export function GraphCanvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<CyberNodeData>>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [selectedNode, setSelectedNode] = useState<Node<CyberNodeData> | null>(null)
  const [selectedNodes, setSelectedNodes] = useState<Set<string>>(new Set())
  const [showHelp, setShowHelp] = useState(false)
  const [minimapExpanded, setMinimapExpanded] = useState(true)
  const [isPanning, setIsPanning] = useState(false)
  const [isSelecting, setIsSelecting] = useState(false)
  const [selectStart, setSelectStart] = useState<{ x: number; y: number } | null>(null)
  const [selectBox, setSelectBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null)
  const [history, setHistory] = useState<Array<{ nodes: Node<CyberNodeData>[]; edges: Edge[] }>>([])
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null)

  // Load from localStorage on mount
  useEffect(() => {
    const savedData = localStorage.getItem("cyber-graph-data")
    if (savedData) {
      try {
        const { nodes: savedNodes, edges: savedEdges } = JSON.parse(savedData)
        setNodes(savedNodes || [])
        setEdges(savedEdges || [])
      } catch {
        // Invalid data, start fresh
      }
    }
  }, [setNodes, setEdges])

  // Helper function to save state to history
  const saveToHistory = useCallback((newNodes: Node<CyberNodeData>[], newEdges: Edge[]) => {
    setHistory((h) => [...h.slice(-49), { nodes: newNodes, edges: newEdges }])
  }, [])

  // Adjust initial zoom level after ReactFlow initializes
  useEffect(() => {
    if (reactFlowInstance) {
      // Zoom out by 3 scroll units (each unit is roughly 0.25 zoom)
      const zoomOutFactor = 1.10
      reactFlowInstance.setCenter(0, 0, { zoom: zoomOutFactor, duration: 0 })
    }
  }, [reactFlowInstance])

  // Auto-save to localStorage
  useEffect(() => {
    if (nodes.length > 0 || edges.length > 0) {
      localStorage.setItem("cyber-graph-data", JSON.stringify({ nodes, edges }))
    }
  }, [nodes, edges])

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge(connection, eds))
    },
    [setEdges]
  )

  const createNode = useCallback(
    (position: { x: number; y: number }, parentId?: string): Node<CyberNodeData> => {
      const id = `node-${Date.now()}`
      return {
        id,
        type: "cyber",
        position,
        data: {
          label: "New Node",
          status: "default" as NodeStatus,
          entityType: "",
          notes: "",
          createdAt: new Date().toISOString(),
        },
      }
    },
    []
  )

  const handleAddNode = useCallback(
    (parentId?: string) => {
      if (!reactFlowInstance) return

      let position = { x: 250, y: 250 }

      if (parentId) {
        const parentNode = nodes.find((n) => n.id === parentId)
        if (parentNode) {
          position = {
            x: parentNode.position.x + 50,
            y: parentNode.position.y + 120,
          }
        }
      } else if (contextMenu) {
        const flowPosition = reactFlowInstance.screenToFlowPosition({
          x: contextMenu.x,
          y: contextMenu.y,
        })
        position = flowPosition
      }

      const newNode = createNode(position, parentId)
      setNodes((nds) => [...nds, newNode])

      if (parentId) {
        const newEdge: Edge = {
          id: `edge-${parentId}-${newNode.id}`,
          source: parentId,
          target: newNode.id,
          ...defaultEdgeOptions,
        }
        setEdges((eds) => [...eds, newEdge])
      }
    },
    [reactFlowInstance, nodes, contextMenu, createNode, setNodes, setEdges]
  )

  const handleSetStatus = useCallback(
    (nodeId: string, status: NodeStatus) => {
      setNodes((nds) =>
        nds.map((node) =>
          node.id === nodeId
            ? { ...node, data: { ...node.data, status } }
            : node
        )
      )
      // Update selected node if it's the one being modified
      if (selectedNode?.id === nodeId) {
        setSelectedNode((prev) =>
          prev ? { ...prev, data: { ...prev.data, status } } : null
        )
      }
    },
    [setNodes, selectedNode]
  )

  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((node) => node.id !== nodeId))
      setEdges((eds) =>
        eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId)
      )
      if (selectedNode?.id === nodeId) {
        setSelectedNode(null)
      }
    },
    [setNodes, setEdges, selectedNode]
  )

  const handleUpdateNode = useCallback(
    (nodeId: string, data: Partial<CyberNodeData>) => {
      setNodes((nds) =>
        nds.map((node) =>
          node.id === nodeId
            ? { ...node, data: { ...node.data, ...data } }
            : node
        )
      )
      // Update selected node to reflect changes
      if (selectedNode?.id === nodeId) {
        setSelectedNode((prev) =>
          prev ? { ...prev, data: { ...prev.data, ...data } } : null
        )
      }
    },
    [setNodes, selectedNode]
  )

  const handleDeleteEdge = useCallback(
    (edgeId: string) => {
      setEdges((eds) => eds.filter((edge) => edge.id !== edgeId))
      saveToHistory(nodes, edges.filter((e) => e.id !== edgeId))
    },
    [setEdges, nodes, edges, saveToHistory]
  )

  const handleReverseEdge = useCallback(
    (edgeId: string) => {
      setEdges((eds) =>
        eds.map((edge) =>
          edge.id === edgeId
            ? { ...edge, source: edge.target, target: edge.source }
            : edge
        )
      )
      const reversedEdges = edges.map((e) =>
        e.id === edgeId ? { ...e, source: e.target, target: e.source } : e
      )
      saveToHistory(nodes, reversedEdges)
    },
    [setEdges, nodes, edges, saveToHistory]
  )

  const onNodeContextMenu: NodeMouseHandler = useCallback(
    (event, node) => {
      event.preventDefault()
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        nodeId: node.id,
      })
    },
    []
  )

  const onEdgeContextMenu = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      event.preventDefault()
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        edgeId: edge.id,
      })
    },
    []
  )

  const onPaneContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault()
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
    })
  }, [])

  const onNodeClick: NodeMouseHandler = useCallback(
    (event, node) => {
      if (event.shiftKey) {
        // Multi-select with Shift
        setSelectedNodes((prev) => {
          const newSet = new Set(prev)
          if (newSet.has(node.id)) {
            newSet.delete(node.id)
          } else {
            newSet.add(node.id)
          }
          return newSet
        })
        setSelectedNode(null)
      } else if ((event.ctrlKey || event.metaKey) && selectedNode) {
        // Add to selection with Ctrl/Cmd
        setSelectedNodes((prev) => new Set(prev).add(node.id))
        setSelectedNode(null)
      } else {
        // Single select
        setSelectedNode(node as Node<CyberNodeData>)
        setSelectedNodes(new Set())
      }
    },
    [selectedNode]
  )

  const onNodeDoubleClick: NodeMouseHandler = useCallback(
    (event, node) => {
      event.stopPropagation()
      // Open detail panel for editing
      setSelectedNode(node as Node<CyberNodeData>)
    },
    []
  )

  const onPaneClick = useCallback(() => {
    setSelectedNode(null)
    setSelectedNodes(new Set())
    setContextMenu(null)
  }, [])

  // Handle pane mouse down for drag-to-select
  const handlePaneMouseDown = useCallback((e: React.MouseEvent) => {
    if (isPanning || e.button !== 0) return // Only left click
    if ((e.target as HTMLElement).closest('.react-flow__node')) return // Don't select if clicking a node

    const rect = reactFlowWrapper.current?.getBoundingClientRect()
    if (!rect) return

    setSelectStart({ x: e.clientX - rect.left, y: e.clientY - rect.top })
    setIsSelecting(true)
  }, [isPanning])

  // Handle pane mouse move for drag-to-select box
  const handlePaneMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isSelecting || !selectStart) return

    const rect = reactFlowWrapper.current?.getBoundingClientRect()
    if (!rect) return

    const currentX = e.clientX - rect.left
    const currentY = e.clientY - rect.top
    const width = currentX - selectStart.x
    const height = currentY - selectStart.y

    setSelectBox({
      x: width > 0 ? selectStart.x : currentX,
      y: height > 0 ? selectStart.y : currentY,
      width: Math.abs(width),
      height: Math.abs(height),
    })
  }, [isSelecting, selectStart])

  // Handle pane mouse up to finalize selection
  const handlePaneMouseUp = useCallback(() => {
    if (!isSelecting || !selectBox) {
      setIsSelecting(false)
      setSelectBox(null)
      return
    }

    // Find nodes within the selection box
    const selectedNodeIds = nodes.filter((node) => {
      const nodeX = node.position.x
      const nodeY = node.position.y
      return (
        nodeX >= selectBox.x &&
        nodeX <= selectBox.x + selectBox.width &&
        nodeY >= selectBox.y &&
        nodeY <= selectBox.y + selectBox.height
      )
    }).map((n) => n.id)

    if (selectedNodeIds.length > 0) {
      setSelectedNodes(new Set(selectedNodeIds))
      setSelectedNode(null)
    }

    setIsSelecting(false)
    setSelectBox(null)
  }, [isSelecting, selectBox, nodes])

  // Custom scroll and zoom handler
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!reactFlowInstance) return

    // Shift + scroll for horizontal pan
    if (e.shiftKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault()
      const { x, y } = reactFlowInstance.getViewport()
      reactFlowInstance.setViewport({
        x: x - (e.deltaY > 0 ? 50 : -50),
        y: y,
        zoom: reactFlowInstance.getZoom(),
      })
    }
    // Ctrl/Cmd + scroll for zoom
    else if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const currentZoom = reactFlowInstance.getZoom()
      const zoomDelta = e.deltaY > 0 ? 0.9 : 1.1
      const newZoom = Math.max(0.1, Math.min(currentZoom * zoomDelta, 4))
      
      // Zoom towards cursor
      const rect = reactFlowWrapper.current?.getBoundingClientRect()
      if (rect) {
        const cursorX = e.clientX - rect.left
        const cursorY = e.clientY - rect.top
        const flowPos = reactFlowInstance.screenToFlowPosition({ x: cursorX, y: cursorY })
        reactFlowInstance.setCenter(flowPos.x, flowPos.y, { zoom: newZoom, duration: 0 })
      }
    }
  }, [reactFlowInstance])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Z for undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        if (history.length > 0) {
          const previous = history[history.length - 1]
          setNodes(previous.nodes)
          setEdges(previous.edges)
          setHistory((h) => h.slice(0, -1))
        }
      }
      // Delete for selected nodes
      if (e.key === "Delete") {
        if (selectedNodes.size > 0) {
          // Delete all selected nodes
          setNodes((nds) => nds.filter((n) => !selectedNodes.has(n.id)))
          setEdges((eds) =>
            eds.filter((edge) => !selectedNodes.has(edge.source) && !selectedNodes.has(edge.target))
          )
          setSelectedNodes(new Set())
          setSelectedNode(null)
        } else if (selectedNode) {
          handleDeleteNode(selectedNode.id)
        }
      }
      // Spacebar for pan mode
      if (e.code === "Space" && !isPanning) {
        e.preventDefault()
        setIsPanning(true)
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setIsPanning(false)
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    document.addEventListener("keyup", handleKeyUp)
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      document.removeEventListener("keyup", handleKeyUp)
    }
  }, [selectedNode, selectedNodes, history, handleDeleteNode, isPanning])

  // Export function
  const handleExport = useCallback(() => {
    const data = JSON.stringify({ nodes, edges }, null, 2)
    const blob = new Blob([data], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `cyber-map-${new Date().toISOString().split("T")[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [nodes, edges])

  // Import function
  const handleImport = useCallback(() => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".json"
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = (event) => {
          try {
            const data = JSON.parse(event.target?.result as string)
            if (data.nodes && data.edges) {
              setNodes(data.nodes)
              setEdges(data.edges)
            }
          } catch {
            console.error("Invalid JSON file")
          }
        }
        reader.readAsText(file)
      }
    }
    input.click()
  }, [setNodes, setEdges])

  return (
    <div ref={reactFlowWrapper} className="relative h-screen w-screen" 
         onMouseDown={handlePaneMouseDown}
         onMouseMove={handlePaneMouseMove}
         onMouseUp={handlePaneMouseUp}
         onWheel={handleWheel}
         style={{ cursor: isPanning ? 'grab' : 'default' }}>
      {/* Drag-to-select box */}
      {selectBox && (
        <div
          className="pointer-events-none fixed border-2 border-primary/50 bg-primary/5 z-30"
          style={{
            left: selectBox.x,
            top: selectBox.y,
            width: selectBox.width,
            height: selectBox.height,
          }}
        />
      )}
      
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={setReactFlowInstance}
        onNodeContextMenu={onNodeContextMenu}
        onEdgeContextMenu={onEdgeContextMenu}
        onPaneContextMenu={onPaneContextMenu}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        className="bg-background"
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1}
          color="var(--muted-foreground)"
          className="opacity-20"
        />
        <Background
          id="grid-lines"
          variant={BackgroundVariant.Lines}
          gap={120}
          color="var(--border)"
          className="opacity-10"
        />
        <Controls 
          className="!absolute !right-4 !bottom-16 !left-auto !border-border !bg-card/80 !backdrop-blur-sm [&>button]:!border-border [&>button]:!bg-transparent [&>button]:!fill-muted-foreground [&>button:hover]:!bg-primary/20 [&>button:hover]:!fill-primary" 
          position="bottom-right"
        />
        
      </ReactFlow>

      {/* Help Button */}
      <div className="absolute bottom-4 left-4 z-10">
        <button
          onClick={() => setShowHelp(!showHelp)}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card/80 text-muted-foreground backdrop-blur-sm transition-all duration-300 hover:bg-muted hover:text-foreground"
        >
          {showHelp ? <X size={18} /> : <CircleHelp size={18} />}
        </button>
        
        {/* Help Popup */}
          <div
          className={`absolute bottom-14 left-0 w-72 origin-bottom-left rounded-lg border border-border bg-card/95 p-4 backdrop-blur-md transition-all duration-300 ease-out ${
            showHelp
              ? "scale-100 opacity-100 translate-y-0"
              : "scale-95 opacity-0 translate-y-2 pointer-events-none"
          }`}
        >
          <h4 className="mb-3 font-mono text-sm font-semibold text-foreground">Quick Guide</h4>
          <ul className="space-y-2 font-mono text-xs text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span>Right-click on canvas to add a new node</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span>Right-click on a node for options (add child, set status, delete)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span>Left-click a node to view and edit details</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span>Shift+click multiple nodes to select</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span>Drag to draw selection box</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span>Press Space and drag to pan</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span>Drag from bottom handle to top to connect nodes</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span>Press Delete to remove selected node(s)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span>Press Ctrl+Z to undo</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Minimap Container */}
      <div className="absolute right-4 top-4 z-20">
        {/* Minimap */}
        <div
          className={`overflow-hidden rounded-lg border border-border bg-card/80 backdrop-blur-sm transition-all duration-300 ease-out ${
            minimapExpanded ? "h-24 w-36 opacity-60 hover:opacity-90" : "h-0 w-36 opacity-0 border-transparent"
          }`}
        >
          <div className="h-full w-full p-1">
            <div className="relative h-full w-full rounded bg-background/50 overflow-hidden">
              {/* Mini edges and nodes representation */}
              {(() => {
                if (nodes.length === 0) return null
                
                // Calculate bounds of all nodes
                const xs = nodes.map(n => n.position.x)
                const ys = nodes.map(n => n.position.y)
                const minX = Math.min(...xs)
                const maxX = Math.max(...xs)
                const minY = Math.min(...ys)
                const maxY = Math.max(...ys)
                
                // Add padding to bounds
                const padding = 50
                const rangeX = Math.max(maxX - minX + padding * 2, 200)
                const rangeY = Math.max(maxY - minY + padding * 2, 150)
                
                // Helper to get normalized position
                const getNormalizedPos = (x: number, y: number) => ({
                  left: Math.max(5, Math.min(95, ((x - minX + padding) / rangeX) * 100)),
                  top: Math.max(5, Math.min(95, ((y - minY + padding) / rangeY) * 100))
                })
                
                // Create node position map for edge rendering
                const nodePositions = new Map(
                  nodes.map(n => [n.id, getNormalizedPos(n.position.x, n.position.y)])
                )
                
                return (
                  <>
                    {/* Render edges as SVG lines */}
                    <svg className="absolute inset-0 h-full w-full">
                      {edges.map((edge) => {
                        const sourcePos = nodePositions.get(edge.source)
                        const targetPos = nodePositions.get(edge.target)
                        if (!sourcePos || !targetPos) return null
                        
                        return (
                          <line
                            key={edge.id}
                            x1={`${sourcePos.left}%`}
                            y1={`${sourcePos.top}%`}
                            x2={`${targetPos.left}%`}
                            y2={`${targetPos.top}%`}
                            stroke="var(--border)"
                            strokeWidth="1"
                            opacity="0.6"
                          />
                        )
                      })}
                    </svg>
                    
                    {/* Render nodes */}
                    {nodes.map((node) => {
                      const data = node.data as CyberNodeData
                      let color = "bg-muted-foreground/50"
                      if (data.status === "in-progress") color = "bg-blue-400"
                      if (data.status === "success") color = "bg-green-400"
                      if (data.status === "failed") color = "bg-red-400"
                      
                      const pos = nodePositions.get(node.id)!
                      
                      return (
                        <div
                          key={node.id}
                          className={`absolute h-1.5 w-1.5 rounded-full ${color}`}
                          style={{ 
                            left: `${pos.left}%`, 
                            top: `${pos.top}%`,
                            transform: 'translate(-50%, -50%)'
                          }}
                        />
                      )
                    })}
                  </>
                )
              })()}
            </div>
          </div>
        </div>
        
        {/* Toggle Button */}
        <button
          onClick={() => setMinimapExpanded(!minimapExpanded)}
          className={`mt-1 flex h-7 w-full items-center justify-center gap-1 rounded border border-border bg-card/80 font-mono text-xs text-muted-foreground backdrop-blur-sm transition-colors hover:bg-muted hover:text-foreground ${
            !minimapExpanded ? "rounded-lg" : ""
          }`}
        >
          {minimapExpanded ? (
            <>
              <ChevronUp size={12} />
              <span>Hide</span>
            </>
          ) : (
            <>
              <ChevronDown size={12} />
              <span>Map</span>
            </>
          )}
        </button>
      </div>

      {/* Import/Export buttons */}
      <div className="absolute right-4 bottom-4 z-10 flex gap-2">
        <button
          onClick={handleImport}
          className="rounded border border-border bg-card/80 px-3 py-1.5 font-mono text-xs text-foreground backdrop-blur-sm transition-colors hover:bg-muted"
        >
          Import
        </button>
        <button
          onClick={handleExport}
          className="rounded border border-primary/50 bg-primary/10 px-3 py-1.5 font-mono text-xs text-primary backdrop-blur-sm transition-colors hover:bg-primary/20"
        >
          Export
        </button>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          nodeId={contextMenu.nodeId}
          edgeId={contextMenu.edgeId}
          onClose={() => setContextMenu(null)}
          onAddNode={handleAddNode}
          onSetStatus={handleSetStatus}
          onDeleteNode={handleDeleteNode}
          onDeleteEdge={handleDeleteEdge}
          onReverseEdge={handleReverseEdge}
        />
      )}

      {/* Detail Panel */}
      {selectedNode && (
        <DetailPanel
          node={selectedNode}
          onClose={() => setSelectedNode(null)}
          onUpdateNode={handleUpdateNode}
        />
      )}
    </div>
  )
}
