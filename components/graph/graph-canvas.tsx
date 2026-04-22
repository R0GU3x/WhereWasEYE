"use client"

import { useCallback, useState, useRef, useEffect } from "react"
import { CircleHelp, X, ChevronDown, ChevronUp, Workflow, Camera, Volume2, VolumeX } from "lucide-react"
import {
  ReactFlow,
  Background,
  Controls,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
  type NodeMouseHandler,
  BackgroundVariant,
  MarkerType,
  SmoothStepEdge,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"

import { CyberNode, type CyberNodeData, type NodeStatus } from "./cyber-node"
import { ContextMenu } from "./context-menu"
import { DetailPanel } from "./detail-panel"
import { CrossingEdge } from "./crossing-edge"
import { SnapshotModal } from "./snapshot-modal"
import { useSound } from "@/hooks/use-sound"

const APP_VERSION = "v4.7.1"

const nodeTypes = {
  cyber: CyberNode,
}

const edgeTypes = {
  smoothstep: SmoothStepEdge,
  crossing: CrossingEdge,
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
  const [isShiftHeld, setIsShiftHeld] = useState(false)
  const [isDrawingSelectBox, setIsDrawingSelectBox] = useState(false)
  const [selectStart, setSelectStart] = useState<{ x: number; y: number } | null>(null)
  const [selectBox, setSelectBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null)
  const [bulkDeleteModal, setBulkDeleteModal] = useState(false)
  const [deleteConfirmNodeId, setDeleteConfirmNodeId] = useState<string | null>(null)
  const [clearCanvasModal, setClearCanvasModal] = useState(false)
  const [useTidyEdges, setUseTidyEdges] = useState(false)
  const [snapshotModal, setSnapshotModal] = useState(false)
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null)
  const { soundEnabled, toggleSound, playSound } = useSound()

  // Load from localStorage on mount
  useEffect(() => {
    const savedData = localStorage.getItem("cyber-graph-data")
    if (savedData) {
      try {
        const { nodes: savedNodes, edges: savedEdges, useTidyEdges: savedTidyEdges } = JSON.parse(savedData)

        // Update nodes with correct status type (handle legacy data)
        const updatedNodes = (savedNodes || []).map((node: Node<CyberNodeData>) => ({
          ...node,
          data: {
            ...node.data,
            status: node.data.status === "not-yet" ? "default" :
              node.data.status === "running" ? "in-progress" :
                node.data.status === "queued" ? "pending" :
                  node.data.status === "pwned" ? "success" :
                    node.data.status === "false-positive" ? "failed" :
                      node.data.status === "exploitable" ? "failed" :
                        node.data.status === "needs-review" ? "pending" :
                          node.data.status || "default"
          }
        }))
        setNodes(updatedNodes)

        // Update edges with proper type
        const tidyMode = savedTidyEdges ?? false
        const updatedEdges = (savedEdges || []).map((edge: Edge) => ({
          ...edge,
          type: tidyMode ? "smoothstep" : "crossing",
          data: { ...edge.data, useSmoothStep: tidyMode },
        }))
        setEdges(updatedEdges)

        if (savedTidyEdges !== undefined) {
          setUseTidyEdges(savedTidyEdges)
        }
      } catch {
        // Invalid data, start fresh
      }
    }
  }, [setNodes, setEdges])

  // Adjust initial zoom level after ReactFlow initializes
  useEffect(() => {
    if (reactFlowInstance) {
      const zoomOutFactor = 1.10
      reactFlowInstance.setCenter(0, 0, { zoom: zoomOutFactor, duration: 0 })
    }
  }, [reactFlowInstance])

  // Auto-save to localStorage
  useEffect(() => {
    if (nodes.length > 0 || edges.length > 0) {
      localStorage.setItem("cyber-graph-data", JSON.stringify({ nodes, edges, useTidyEdges }))
    }
  }, [nodes, edges, useTidyEdges])

  const onConnect = useCallback(
    (connection: Connection) => {
      const newEdge = {
        ...connection,
        type: useTidyEdges ? "smoothstep" : "crossing",
        data: { useSmoothStep: useTidyEdges },
      }
      setEdges((eds) => addEdge(newEdge, eds))
      playSound("edgeConnect")
    },
    [setEdges, useTidyEdges, playSound]
  )

  const createNode = useCallback(
    (position: { x: number; y: number }): Node<CyberNodeData> => {
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
          const existingChildren = edges.filter((e) => e.source === parentId).length
          const baseOffsetY = 120
          const spreadAngle = 30
          const maxSpread = 60

          const totalChildren = existingChildren + 1
          let angle = 0
          if (totalChildren > 1) {
            const step = Math.min(spreadAngle, (maxSpread * 2) / (totalChildren - 1))
            angle = -maxSpread + (existingChildren * step) + (step / 2)
          }

          const radians = (angle * Math.PI) / 180
          const xOffset = Math.sin(radians) * baseOffsetY

          position = {
            x: parentNode.position.x + xOffset,
            y: parentNode.position.y + baseOffsetY,
          }
        }
      } else if (contextMenu) {
        const flowPosition = reactFlowInstance.screenToFlowPosition({
          x: contextMenu.x,
          y: contextMenu.y,
        })
        position = flowPosition
      }

      const newNode = createNode(position)
      setNodes((nds) => [...nds, newNode])
      playSound("nodeCreate")

      if (parentId) {
        const newEdge: Edge = {
          id: `edge-${parentId}-${newNode.id}`,
          source: parentId,
          target: newNode.id,
          ...defaultEdgeOptions,
          type: useTidyEdges ? "smoothstep" : "crossing",
          data: { useSmoothStep: useTidyEdges },
        }
        setEdges((eds) => [...eds, newEdge])
      }
    },
    [reactFlowInstance, nodes, edges, contextMenu, createNode, setNodes, setEdges, useTidyEdges, playSound]
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
      if (selectedNode?.id === nodeId) {
        setSelectedNode((prev) =>
          prev ? { ...prev, data: { ...prev.data, status } } : null
        )
      }
      playSound("statusChange")
    },
    [setNodes, selectedNode, playSound]
  )

  const requestDeleteNode = useCallback((nodeId: string) => {
    setDeleteConfirmNodeId(nodeId)
  }, [])

  const handleConfirmDeleteNode = useCallback(() => {
    if (!deleteConfirmNodeId) return
    setNodes((nds) => nds.filter((node) => node.id !== deleteConfirmNodeId))
    setEdges((eds) =>
      eds.filter((edge) => edge.source !== deleteConfirmNodeId && edge.target !== deleteConfirmNodeId)
    )
    if (selectedNode?.id === deleteConfirmNodeId) {
      setSelectedNode(null)
    }
    setDeleteConfirmNodeId(null)
    playSound("nodeDelete")
  }, [setNodes, setEdges, selectedNode, deleteConfirmNodeId, playSound])

  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((node) => node.id !== nodeId))
      setEdges((eds) =>
        eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId)
      )
      if (selectedNode?.id === nodeId) {
        setSelectedNode(null)
      }
      playSound("nodeDelete")
    },
    [setNodes, setEdges, selectedNode, playSound]
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
      playSound("edgeDisconnect")
    },
    [setEdges, playSound]
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
      playSound("click")
    },
    [setEdges, playSound]
  )

  const handleTidyEdges = useCallback(() => {
    setUseTidyEdges((prev) => {
      const newValue = !prev
      setEdges((eds) =>
        eds.map((edge) => ({
          ...edge,
          type: newValue ? "smoothstep" : "crossing",
          data: { ...edge.data, useSmoothStep: newValue },
        }))
      )
      return newValue
    })
    playSound("click")
  }, [setEdges, playSound])

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

  const onPaneContextMenu = useCallback((event: MouseEvent | React.MouseEvent) => {
    event.preventDefault()
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
    })
  }, [])

  const onNodeClick: NodeMouseHandler = useCallback(
    (event, node) => {
      // Shift+click to add/remove from multi-selection
      if (event.shiftKey) {
        setSelectedNodes((prev) => {
          const newSet = new Set(prev)
          if (selectedNode && !newSet.has(selectedNode.id)) {
            newSet.add(selectedNode.id)
          }
          if (newSet.has(node.id)) {
            newSet.delete(node.id)
          } else {
            newSet.add(node.id)
          }
          return newSet
        })
        setSelectedNode(null)
      } else {
        // Normal click - open detail panel
        setSelectedNode(node as Node<CyberNodeData>)
        setSelectedNodes(new Set())
      }
    },
    [selectedNode]
  )

  const onNodeDoubleClick: NodeMouseHandler = useCallback(
    (event, node) => {
      event.stopPropagation()
      setSelectedNode(node as Node<CyberNodeData>)
    },
    []
  )

  const onPaneClick = useCallback(() => {
    if (!isDrawingSelectBox) {
      setSelectedNode(null)
      if (!isShiftHeld) {
        setSelectedNodes(new Set())
      }
    }
    setContextMenu(null)
  }, [isDrawingSelectBox, isShiftHeld])

  // Handle pane mouse down for Shift + drag selection box
  const handlePaneMouseDown = useCallback((e: React.MouseEvent) => {
    if (!isShiftHeld || e.button !== 0) return
    if ((e.target as HTMLElement).closest('.react-flow__node')) return

    const rect = reactFlowWrapper.current?.getBoundingClientRect()
    if (!rect) return

    setSelectStart({ x: e.clientX - rect.left, y: e.clientY - rect.top })
    setIsDrawingSelectBox(true)
  }, [isShiftHeld])

  // Handle pane mouse move for selection box
  const handlePaneMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDrawingSelectBox || !selectStart) return

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
  }, [isDrawingSelectBox, selectStart])

  // Handle pane mouse up to finalize selection
  const handlePaneMouseUp = useCallback(() => {
    if (!isDrawingSelectBox || !selectBox || !reactFlowInstance) {
      setIsDrawingSelectBox(false)
      setSelectBox(null)
      setSelectStart(null)
      return
    }

    if (selectBox.width < 5 && selectBox.height < 5) {
      setIsDrawingSelectBox(false)
      setSelectBox(null)
      setSelectStart(null)
      return
    }

    const rect = reactFlowWrapper.current?.getBoundingClientRect()
    if (!rect) {
      setIsDrawingSelectBox(false)
      setSelectBox(null)
      setSelectStart(null)
      return
    }

    const topLeft = reactFlowInstance.screenToFlowPosition({
      x: selectBox.x + rect.left,
      y: selectBox.y + rect.top,
    })
    const bottomRight = reactFlowInstance.screenToFlowPosition({
      x: selectBox.x + selectBox.width + rect.left,
      y: selectBox.y + selectBox.height + rect.top,
    })

    const flowSelectBox = {
      x: Math.min(topLeft.x, bottomRight.x),
      y: Math.min(topLeft.y, bottomRight.y),
      width: Math.abs(bottomRight.x - topLeft.x),
      height: Math.abs(bottomRight.y - topLeft.y),
    }

    const nodeWidth = 140
    const nodeHeight = 60
    const selectedNodeIds = nodes.filter((node) => {
      const nodeLeft = node.position.x
      const nodeTop = node.position.y
      const nodeRight = nodeLeft + nodeWidth
      const nodeBottom = nodeTop + nodeHeight

      const boxLeft = flowSelectBox.x
      const boxTop = flowSelectBox.y
      const boxRight = flowSelectBox.x + flowSelectBox.width
      const boxBottom = flowSelectBox.y + flowSelectBox.height

      return (
        nodeLeft < boxRight &&
        nodeRight > boxLeft &&
        nodeTop < boxBottom &&
        nodeBottom > boxTop
      )
    }).map((n) => n.id)

    if (selectedNodeIds.length > 0) {
      setSelectedNodes((prev) => {
        const newSet = new Set(prev)
        selectedNodeIds.forEach((id) => newSet.add(id))
        return newSet
      })
      setNodes((nds) =>
        nds.map((node) => ({
          ...node,
          selected: selectedNodeIds.includes(node.id) || selectedNodes.has(node.id),
        }))
      )
    }

    setSelectedNode(null)
    setIsDrawingSelectBox(false)
    setSelectBox(null)
    setSelectStart(null)
  }, [isDrawingSelectBox, selectBox, nodes, reactFlowInstance, selectedNodes, setNodes])

  // Custom scroll and zoom handler
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!reactFlowInstance) return

    // Shift + scroll: horizontal panning
    if (e.shiftKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault()
      const { x, y } = reactFlowInstance.getViewport()
      reactFlowInstance.setViewport({
        x: x - (e.deltaY > 0 ? 50 : -50),
        y: y,
        zoom: reactFlowInstance.getZoom(),
      })
    // Ctrl/Cmd + scroll: zoom
    } else if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const currentZoom = reactFlowInstance.getZoom()
      const zoomDelta = e.deltaY > 0 ? 0.9 : 1.1
      const newZoom = Math.max(0.1, Math.min(currentZoom * zoomDelta, 4))

      const rect = reactFlowWrapper.current?.getBoundingClientRect()
      if (rect) {
        const cursorX = e.clientX - rect.left
        const cursorY = e.clientY - rect.top
        const flowPos = reactFlowInstance.screenToFlowPosition({ x: cursorX, y: cursorY })
        reactFlowInstance.setCenter(flowPos.x, flowPos.y, { zoom: newZoom, duration: 0 })
      }
    // Normal scroll: vertical panning
    } else if (!e.shiftKey) {
      e.preventDefault()
      const { x, y } = reactFlowInstance.getViewport()
      reactFlowInstance.setViewport({
        x: x,
        y: y - (e.deltaY > 0 ? 50 : -50),
        zoom: reactFlowInstance.getZoom(),
      })
    }
  }, [reactFlowInstance])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA'

      // Track shift key
      if (e.key === "Shift") {
        setIsShiftHeld(true)
      }

      // Delete/Backspace for selected nodes
      if ((e.key === "Delete" || e.key === "Backspace") && !isInput) {
        e.preventDefault()
        if (selectedNodes.size > 0) {
          setBulkDeleteModal(true)
        } else if (selectedNode) {
          requestDeleteNode(selectedNode.id)
        }
      }

      // Escape clears selection
      if (e.key === "Escape" && !isInput) {
        setSelectedNode(null)
        setSelectedNodes(new Set())
        setContextMenu(null)
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Shift") {
        setIsShiftHeld(false)
        setIsDrawingSelectBox(false)
        setSelectBox(null)
        setSelectStart(null)
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    document.addEventListener("keyup", handleKeyUp)
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      document.removeEventListener("keyup", handleKeyUp)
    }
  }, [selectedNode, selectedNodes, requestDeleteNode])

  // Export function
  const handleExport = useCallback(() => {
    const data = JSON.stringify({ nodes, edges, useTidyEdges }, null, 2)
    const blob = new Blob([data], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `cyber-map-${new Date().toISOString().split("T")[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [nodes, edges, useTidyEdges])

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
              const updatedNodes = data.nodes.map((node: Node<CyberNodeData>) => ({
                ...node,
                data: {
                  ...node.data,
                  status: node.data.status === "not-yet" ? "default" :
                    node.data.status === "running" ? "in-progress" :
                      node.data.status === "queued" ? "pending" :
                        node.data.status === "pwned" ? "success" :
                          node.data.status === "false-positive" ? "failed" :
                            node.data.status === "exploitable" ? "failed" :
                              node.data.status === "needs-review" ? "pending" :
                                node.data.status || "default"
                }
              }))
              setNodes(updatedNodes)

              const tidyMode = data.useTidyEdges ?? false
              const updatedEdges = data.edges.map((edge: Edge) => ({
                ...edge,
                type: tidyMode ? "smoothstep" : "crossing",
                data: { ...edge.data, useSmoothStep: tidyMode },
              }))
              setEdges(updatedEdges)

              if (data.useTidyEdges !== undefined) {
                setUseTidyEdges(data.useTidyEdges)
              }
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

  // Bulk status update
  const handleBulkStatusUpdate = useCallback(
    (status: NodeStatus) => {
      const updatedNodes = nodes.map((node) =>
        selectedNodes.has(node.id)
          ? { ...node, data: { ...node.data, status } }
          : node
      )
      setNodes(updatedNodes)
      setSelectedNodes(new Set())
      playSound("statusChange")
    },
    [nodes, selectedNodes, setNodes, playSound]
  )

  // Bulk delete with confirmation
  const handleBulkDelete = useCallback(() => {
    const newNodes = nodes.filter((n) => !selectedNodes.has(n.id))
    const newEdges = edges.filter(
      (e) => !selectedNodes.has(e.source) && !selectedNodes.has(e.target)
    )
    setNodes(newNodes)
    setEdges(newEdges)
    setBulkDeleteModal(false)
    setSelectedNodes(new Set())
    playSound("nodeDelete")
  }, [nodes, edges, selectedNodes, setNodes, setEdges, playSound])

  // Clear canvas handler
  const handleClearCanvasRequest = useCallback(() => {
    setClearCanvasModal(true)
  }, [])

  const handleClearCanvas = useCallback(() => {
    setNodes([])
    setEdges([])
    setSelectedNode(null)
    setSelectedNodes(new Set())
    localStorage.removeItem("cyber-graph-data")
    setClearCanvasModal(false)
    playSound("nodeDelete")
  }, [setNodes, setEdges, playSound])

  // Check if canvas is empty
  const isCanvasEmpty = nodes.length === 0

  return (
    <div
      ref={reactFlowWrapper}
      className="relative h-screen w-screen"
      onMouseDown={handlePaneMouseDown}
      onMouseMove={handlePaneMouseMove}
      onMouseUp={handlePaneMouseUp}
      onWheel={handleWheel}
      style={{ cursor: isShiftHeld ? 'crosshair' : 'grab' }}
    >
      {/* Selection box */}
      {selectBox && (
        <div
          className="pointer-events-none absolute z-50 rounded border-2 border-dashed border-primary bg-primary/10"
          style={{
            left: `${selectBox.x}px`,
            top: `${selectBox.y}px`,
            width: `${selectBox.width}px`,
            height: `${selectBox.height}px`,
            boxShadow: "0 0 20px var(--glow-cyan), inset 0 0 10px var(--glow-cyan)",
          }}
        />
      )}

      {/* Empty Canvas Art */}
      {isCanvasEmpty && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <div className="flex flex-col items-center gap-6 opacity-30">
            {/* ASCII Art Style Robot/Hacker */}
            <pre className="font-mono text-xs text-muted-foreground leading-none select-none">
              {`
                                          ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
                                          ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⡀⠀⠀⠀⢰⠂⠀⠀⠀⠀⠀⠀⠀
                                          ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠄⠀⠀⠀⠉⣷⠀⠀⢸⡄⠀⠀⠀⠀⠀⠀⠀
                                          ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢻⡄⠀⠀⠀⠀⣿⠀⠀⠈⣿⣦⣄⠀⠀⠀⠀⠀
                                          ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⡸⣞⡇⠀⠀⠀⣼⡿⠀⠀⠀⠀⠉⠉⠀⠀⠀⠀⠀
                                          ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣧⢿⣽⡀⠀⠉⠛⠁⠀⣰⣾⠿⠿⣦⡀⠀⠀⠀⠀
                                          ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣼⣞⡿⣞⡅⠀⠀⠀⠀⠘⠏⠓⠒⠒⠀⠀⠀⠀⠀⠀
                                          ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣰⣟⢾⣽⢫⡿⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
                                          ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣠⢤⣶⡻⣞⣿⣺⢯⣽⣳⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
                                          ⠀⠀⠀⠀⠀⠀⠀⠀⢠⣄⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣀⣠⣤⣿⣽⣻⢾⣽⣷⣾⣽⣻⣞⣷⣳⡄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
                                          ⠀⠀⠀⠀⠀⠀⠀⠀⠈⢻⣿⣶⣄⡀⠀⠀⠀⣀⣲⣴⢶⣞⡿⣽⣞⡷⣯⢿⡽⣞⣿⠟⠋⠁⠉⠈⠳⣟⣆⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
                                          ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢻⣿⣿⣿⣿⢶⣾⣿⡽⣯⣟⡾⣽⡷⣯⣟⡽⡾⣽⡯⠁⠀⠀⠀⠀⠀⠀⢮⣭⣦⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀
                                          ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠉⢞⣿⣿⢯⡿⣿⣯⣟⣷⣯⢿⣳⣟⡷⣽⣼⣻⣽⠀⠀⠀⠀⠀⠀⠀⢀⣼⡯⡗⠋⠤⠀⠀⠀⠀⠀⠀⠀⠀
                                          ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢾⣿⣿⣯⣽⣾⣿⣾⣗⡿⣯⡷⣯⣟⡷⣞⣼⣿⣀⠀⠀⠀⠀⢀⣠⡿⣏⡗⠈⠐⠈⠅⠀⠀⠀⠀⠀⠀⠀
                                          ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣼⠛⠏⠉⠉⠽⢟⢿⣿⣿⣿⣿⣷⣻⢾⡽⣞⡷⠄⡹⣶⢿⣻⢿⣻⡽⢯⣼⢦⠶⠁⠈⠀⠀⠀⠀⠀⠀⠀
                                          ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣸⣯⠇⠀⠀⠀⠀⠀⠁⣽⣿⣿⣿⣷⣯⣿⣽⣛⡦⠀⠀⢩⣿⣹⢯⣷⢻⣟⠺⢣⡖⣘⠤⠓⠀⠀⠀⠀⠀⠀
                                          ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢈⣿⡃⠁⠀⠀⠀⢀⣤⣾⣟⢿⣻⣿⣿⣟⡾⣽⡳⠄⠎⢳⣯⢯⣟⡾⢯⣞⣯⣓⠉⢀⠀⠀⡄⢢⡀⠀⠀⠀
                                          ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣸⣷⣷⣶⣳⣶⣺⣿⣿⣳⢯⣟⣿⣿⣳⢯⠛⠅⠃⠀⠀⣴⣿⡿⣬⢶⠾⠙⣊⣥⠾⡒⠊⢁⢠⠣⣌⠀⠀⠀
                                          ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢺⡽⣾⡽⣯⣟⣿⡿⣯⣿⣿⣾⢿⣿⠳⢏⣈⢠⠀⠀⣰⢿⡿⣽⣉⡶⠌⠋⠉⣀⡀⠁⠀⠀⠀⣘⡐⣂⠀⠀
                                          ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠘⣽⣳⣟⣳⣟⣾⣽⣿⣿⣿⣿⣿⣦⣜⡻⡽⠆⠧⣴⡟⣯⢟⡳⣭⠲⠄⠐⠀⠀⠀⠈⠁⠉⠑⢊⡕⢃⠄⠀
                                          ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠹⣿⣾⣿⣯⣿⣾⣿⣿⣿⣿⣿⣿⣿⣿⣾⢧⠀⠹⠾⡵⡞⡽⢢⣃⠐⠀⠀⠄⡐⠀⠀⠀⡘⢦⠘⣌⠀⠀
                                          ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠐⠹⢿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⢯⡏⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣀⠒⡈⠀⡀⠄⡑⠢⣉⠴⣈⣆
                                          ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣀⠻⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⢯⣏⡴⣶⣵⣢⢤⢠⡀⡄⢠⠐⡰⢌⡱⠀⡁⡀⠆⡥⠆⡥⣛⡽⣾
                                          ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⡀⠔⠉⠀⠀⢽⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣼⣻⢷⣯⡽⣞⣷⣻⡼⣡⢋⡔⠣⠜⡐⢐⠠⡓⣤⣙⣲⣽⣻⢷
                                          ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠘⢿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣷⡿⣽⣞⣷⣻⡴⣣⢜⡱⣊⡕⣊⠠⡙⡰⣭⢷⣯⣿⢿
                                                        

  /$$$$$$                     /$$      /$$ /$$   /$$ /$$$$$$$$ /$$$$$$$  /$$$$$$$$       /$$      /$$  /$$$$$$   /$$$$$$        /$$$$$$        /$$$$ 
 /$$__  $$                   | $$  /$ | $$| $$  | $$| $$_____/| $$__  $$| $$_____/      | $$  /$ | $$ /$$__  $$ /$$__  $$      |_  $$_/       /$$  $$
| $$  \__/  /$$$$$$          | $$ /$$$| $$| $$  | $$| $$      | $$  \ $$| $$            | $$ /$$$| $$| $$  \ $$| $$  \__/        | $$        |__/\ $$
|  $$$$$$  /$$__  $$         | $$/$$ $$ $$| $$$$$$$$| $$$$$   | $$$$$$$/| $$$$$         | $$/$$ $$ $$| $$$$$$$$|  $$$$$$         | $$            /$$/
 \____  $$| $$  \ $$         | $$$$_  $$$$| $$__  $$| $$__/   | $$__  $$| $$__/         | $$$$_  $$$$| $$__  $$ \____  $$        | $$           /$$/ 
 /$$  \ $$| $$  | $$         | $$$/ \  $$$| $$  | $$| $$      | $$  \ $$| $$            | $$$/ \  $$$| $$  | $$ /$$  \ $$        | $$          |__/  
|  $$$$$$/|  $$$$$$//$$      | $$/   \  $$| $$  | $$| $$$$$$$$| $$  | $$| $$$$$$$$      | $$/   \  $$| $$  | $$|  $$$$$$/       /$$$$$$         /$$  
 \______/  \______/| $/      |__/     \__/|__/  |__/|________/|__/  |__/|________/      |__/     \__/|__/  |__/ \______/       |______/        |__/  
                   |_/                                                                                                                               
                                                                                                                                                     
                                                                                                                                                     

`}
            </pre>
          </div>
        </div>
      )}

      <ReactFlow
        nodes={nodes.map((node) => ({
          ...node,
          selected: selectedNodes.has(node.id) || node.selected,
        }))}
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
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        panOnDrag={!isShiftHeld}
        selectionOnDrag={false}
        selectNodesOnDrag={false}
        zoomOnScroll={false}
        zoomOnPinch={true}
        zoomOnDoubleClick={false}
        className="bg-background [&_.react-flow__nodesselection-rect]:!hidden [&_.react-flow__selection]:!hidden"
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
          className={`absolute bottom-14 left-0 w-72 origin-bottom-left rounded-lg border border-border bg-card/95 p-4 backdrop-blur-md transition-all duration-300 ease-out ${showHelp
            ? "scale-100 opacity-100 translate-y-0"
            : "scale-95 opacity-0 translate-y-2 pointer-events-none"
            }`}
        >
          <h4 className="mb-3 font-mono text-sm font-semibold text-foreground">Quick Guide</h4>
          <ul className="space-y-2 font-mono text-xs text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span><strong>Drag canvas</strong> to pan around</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span><strong>Hold Shift + Drag</strong> to draw selection box</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span><strong>Shift + Click</strong> to multi-select nodes</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span><strong>Right-click</strong> for context menu options</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span><strong>Scroll:</strong> pan up/down</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span><strong>Shift + Scroll:</strong> pan left/right</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span><strong>Ctrl + Scroll:</strong> zoom in/out at cursor</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span><strong>Delete/Backspace:</strong> remove selected nodes</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span><strong>Escape:</strong> clear selection</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Bulk Operations Toolbar */}
      {selectedNodes.size > 0 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 bg-card/95 border border-border rounded-lg p-3 backdrop-blur-sm flex items-center gap-2 flex-wrap justify-center max-w-3xl">
          <span className="font-mono text-sm text-muted-foreground">{selectedNodes.size} selected</span>
          <div className="h-4 w-px bg-border" />
          <button
            onClick={() => handleBulkStatusUpdate("in-progress")}
            className="rounded px-3 py-1 text-sm font-medium bg-[var(--node-in-progress)]/10 text-[var(--node-in-progress)] hover:bg-[var(--node-in-progress)]/20 transition-colors"
          >
            In-Progress
          </button>
          <button
            onClick={() => handleBulkStatusUpdate("pending")}
            className="rounded px-3 py-1 text-sm font-medium bg-[var(--node-pending)]/10 text-[var(--node-pending)] hover:bg-[var(--node-pending)]/20 transition-colors"
          >
            Pending
          </button>
          <button
            onClick={() => handleBulkStatusUpdate("success")}
            className="rounded px-3 py-1 text-sm font-medium bg-[var(--node-success)]/10 text-[var(--node-success)] hover:bg-[var(--node-success)]/20 transition-colors"
          >
            Success
          </button>
          <button
            onClick={() => handleBulkStatusUpdate("failed")}
            className="rounded px-3 py-1 text-sm font-medium bg-[var(--node-failed)]/10 text-[var(--node-failed)] hover:bg-[var(--node-failed)]/20 transition-colors"
          >
            Failed
          </button>
          <button
            onClick={() => handleBulkStatusUpdate("interesting")}
            className="rounded px-3 py-1 text-sm font-medium bg-[var(--node-interesting)]/10 text-[var(--node-interesting)] hover:bg-[var(--node-interesting)]/20 transition-colors"
          >
            Interesting
          </button>
          <button
            onClick={() => handleBulkStatusUpdate("default")}
            className="rounded px-3 py-1 text-sm font-medium bg-muted/20 text-muted-foreground hover:bg-muted/30 transition-colors"
          >
            Reset
          </button>
          <div className="h-4 w-px bg-border" />
          <button
            onClick={() => setSnapshotModal(true)}
            className="rounded px-3 py-1 text-sm font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors flex items-center gap-1"
          >
            <Camera size={14} />
            Snapshot
          </button>
          <button
            onClick={() => setBulkDeleteModal(true)}
            className="rounded px-3 py-1 text-sm font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
          >
            Delete
          </button>
        </div>
      )}

      {/* Minimap Container */}
      <div className="absolute right-4 top-4 z-20">
        <div
          className={`overflow-hidden rounded-lg border border-border bg-card/80 backdrop-blur-sm transition-all duration-300 ease-out ${minimapExpanded ? "h-24 w-36 opacity-60 hover:opacity-90" : "h-0 w-36 opacity-0 border-transparent"
            }`}
        >
          <div className="h-full w-full p-1">
            <div className="relative h-full w-full rounded bg-background/50 overflow-hidden">
              {(() => {
                if (nodes.length === 0) return null

                const xs = nodes.map(n => n.position.x)
                const ys = nodes.map(n => n.position.y)
                const minX = Math.min(...xs)
                const maxX = Math.max(...xs)
                const minY = Math.min(...ys)
                const maxY = Math.max(...ys)

                const padding = 50
                const rangeX = Math.max(maxX - minX + padding * 2, 200)
                const rangeY = Math.max(maxY - minY + padding * 2, 150)

                const getNormalizedPos = (x: number, y: number) => ({
                  left: Math.max(5, Math.min(95, ((x - minX + padding) / rangeX) * 100)),
                  top: Math.max(5, Math.min(95, ((y - minY + padding) / rangeY) * 100))
                })

                const nodePositions = new Map(
                  nodes.map(n => [n.id, getNormalizedPos(n.position.x, n.position.y)])
                )

                return (
                  <>
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

                    {nodes.map((node) => {
                      const data = node.data as CyberNodeData
                      const pos = nodePositions.get(node.id)!

                      const statusColorMap: Record<NodeStatus, string> = {
                        "default": "var(--node-default)",
                        "in-progress": "var(--node-in-progress)",
                        "pending": "var(--node-pending)",
                        "success": "var(--node-success)",
                        "failed": "var(--node-failed)",
                        "interesting": "var(--node-interesting)",
                      }

                      return (
                        <div
                          key={node.id}
                          className="absolute h-1.5 w-1.5 rounded-full"
                          style={{
                            left: `${pos.left}%`,
                            top: `${pos.top}%`,
                            transform: 'translate(-50%, -50%)',
                            backgroundColor: statusColorMap[data.status] || "var(--muted-foreground)",
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

        <button
          onClick={() => setMinimapExpanded(!minimapExpanded)}
          className={`mt-1 flex h-7 w-full items-center justify-center gap-1 rounded border border-border bg-card/80 font-mono text-xs text-muted-foreground backdrop-blur-sm transition-colors hover:bg-muted hover:text-foreground ${!minimapExpanded ? "rounded-lg" : ""
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

      {/* Import/Export/Tidy buttons */}
      <div className="absolute right-4 bottom-4 z-10 flex gap-2">
        <button
          onClick={toggleSound}
          className={`flex items-center justify-center rounded border p-1.5 backdrop-blur-sm transition-colors ${soundEnabled
            ? "border-primary bg-primary/20 text-primary"
            : "border-border bg-card/80 text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          title={soundEnabled ? "Disable sound effects" : "Enable sound effects"}
        >
          {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
        </button>
        <button
          onClick={() => setSnapshotModal(true)}
          className="flex items-center gap-1.5 rounded border border-border bg-card/80 px-3 py-1.5 font-mono text-xs text-foreground backdrop-blur-sm transition-colors hover:bg-muted"
          title="Take a snapshot of the canvas"
        >
          <Camera size={14} />
          Snapshot
        </button>
        <button
          onClick={handleTidyEdges}
          className={`flex items-center gap-1.5 rounded border px-3 py-1.5 font-mono text-xs backdrop-blur-sm transition-colors ${useTidyEdges
            ? "border-primary bg-primary/20 text-primary"
            : "border-border bg-card/80 text-foreground hover:bg-muted"
            }`}
          title={useTidyEdges ? "Switch to curved edges" : "Tidy edges (circuit-style)"}
        >
          <Workflow size={14} />
          Tidy
        </button>
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

      {/* Version Display */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
        <span className="font-mono text-xs text-muted-foreground/50">{APP_VERSION}</span>
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
          onDeleteNode={requestDeleteNode}
          onDeleteEdge={handleDeleteEdge}
          onReverseEdge={handleReverseEdge}
          onClearCanvas={handleClearCanvasRequest}
          onSnapshot={() => setSnapshotModal(true)}
        />
      )}

      {/* Detail Panel */}
      {selectedNode && (
        <DetailPanel
          node={selectedNode}
          onClose={() => setSelectedNode(null)}
          onUpdateNode={handleUpdateNode}
          onDeleteNode={handleDeleteNode}
        />
      )}

      {/* Bulk Delete Confirmation Modal */}
      {bulkDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="rounded-lg border border-border bg-card p-6 shadow-xl max-w-sm mx-4">
            <h3 className="mb-2 text-lg font-semibold text-foreground">Delete {selectedNodes.size} Node{selectedNodes.size !== 1 ? 's' : ''}?</h3>
            <p className="mb-6 text-sm text-muted-foreground">This action cannot be undone. All connected edges will also be removed.</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setBulkDeleteModal(false)}
                className="rounded px-4 py-2 font-medium text-foreground border border-border hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                className="rounded px-4 py-2 font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
              >
                Delete All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Single Node Delete Confirmation Modal */}
      {deleteConfirmNodeId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="rounded-lg border border-border bg-card p-6 shadow-xl max-w-sm mx-4">
            <h3 className="mb-2 text-lg font-semibold text-foreground">Delete Node?</h3>
            <p className="mb-6 text-sm text-muted-foreground">This action cannot be undone. All connected edges will also be removed.</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirmNodeId(null)}
                className="rounded px-4 py-2 font-medium text-foreground border border-border hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDeleteNode}
                className="rounded px-4 py-2 font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Canvas Confirmation Modal */}
      {clearCanvasModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="rounded-lg border border-border bg-card p-6 shadow-xl max-w-sm mx-4">
            <h3 className="mb-2 text-lg font-semibold text-foreground">Clear Canvas?</h3>
            <p className="mb-6 text-sm text-muted-foreground">This will remove all nodes and edges. This action cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setClearCanvasModal(false)}
                className="rounded px-4 py-2 font-medium text-foreground border border-border hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleClearCanvas}
                className="rounded px-4 py-2 font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Snapshot Modal */}
      {snapshotModal && (
        <SnapshotModal
          nodes={nodes}
          edges={edges}
          selectedNodeIds={selectedNodes.size > 0 ? selectedNodes : undefined}
          onClose={() => setSnapshotModal(false)}
          onExport={() => playSound("success")}
        />
      )}
    </div>
  )
}
