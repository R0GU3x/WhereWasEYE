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
}

export function GraphCanvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<CyberNodeData>>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [selectedNode, setSelectedNode] = useState<Node<CyberNodeData> | null>(null)
  const [showHelp, setShowHelp] = useState(false)
  const [minimapExpanded, setMinimapExpanded] = useState(true)
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

  const onPaneContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault()
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
    })
  }, [])

  const onNodeClick: NodeMouseHandler = useCallback(
    (event, node) => {
      setSelectedNode(node as Node<CyberNodeData>)
    },
    []
  )

  const onPaneClick = useCallback(() => {
    setSelectedNode(null)
    setContextMenu(null)
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Delete" && selectedNode) {
        handleDeleteNode(selectedNode.id)
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [selectedNode, handleDeleteNode])

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
    <div ref={reactFlowWrapper} className="relative h-screen w-screen">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={setReactFlowInstance}
        onNodeContextMenu={onNodeContextMenu}
        onPaneContextMenu={onPaneContextMenu}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
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
              <span>Drag from bottom handle to top handle to connect nodes</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span>Press Delete key to remove selected node</span>
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
          onClose={() => setContextMenu(null)}
          onAddNode={handleAddNode}
          onSetStatus={handleSetStatus}
          onDeleteNode={handleDeleteNode}
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
