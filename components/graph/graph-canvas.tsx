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
  type NodeChange,
  type XYPosition,
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
import { toast } from "@/components/ui/use-toast"
import { cn } from "@/lib/utils"

const APP_VERSION = "v4.7.3"

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
  const helpContainerRef = useRef<HTMLDivElement>(null)
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
  const [fileDragState, setFileDragState] = useState<"idle" | "valid" | "invalid">("idle")
  const fileDragDepth = useRef(0)
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null)
  const connectionStartNodeId = useRef<string | null>(null)
  const nodeDragSession = useRef<{
    nodeIds: string[]
    startPositions: Record<string, XYPosition>
    anchorId: string
    anchorStart: XYPosition
    pointerOffset: XYPosition
    axis: "x" | "y" | null
    shiftState: boolean
  } | null>(null)
  const [alignmentGuide, setAlignmentGuide] = useState<{
    axis: "vertical" | "horizontal"
    coordinate: number
  } | null>(null)
  const initialFitViewComplete = useRef(false)
  const historyRef = useRef<Array<{ nodes: Node<CyberNodeData>[]; edges: Edge[] }>>([])
  const historyIndexRef = useRef(-1)
  const historyReadyRef = useRef(false)
  const restoringHistoryRef = useRef(false)
  const [, setHistoryVersion] = useState(0)
  const isNodeDragging = useRef(false)
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
            status: String(node.data.status) === "not-yet" ? "default" :
              String(node.data.status) === "running" ? "in-progress" :
                String(node.data.status) === "queued" ? "pending" :
                  String(node.data.status) === "pwned" ? "success" :
                    String(node.data.status) === "false-positive" ? "failed" :
                      String(node.data.status) === "exploitable" ? "failed" :
                        String(node.data.status) === "needs-review" ? "pending" :
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

  // Fit once after the browser page initializes and restored nodes are available.
  // The ref prevents graph edits from ever re-triggering this automatic viewport change.
  useEffect(() => {
    if (initialFitViewComplete.current || !reactFlowInstance || nodes.length === 0) return

    const frame = requestAnimationFrame(() => {
      if (initialFitViewComplete.current) return
      reactFlowInstance.fitView({ padding: 0.2, duration: 0, includeHiddenNodes: true })
      initialFitViewComplete.current = true
    })

    return () => cancelAnimationFrame(frame)
  }, [reactFlowInstance, nodes.length])

  const pushHistory = useCallback((nextNodes: Node<CyberNodeData>[], nextEdges: Edge[]) => {
    if (restoringHistoryRef.current) return
    const snapshot = { nodes: structuredClone(nextNodes), edges: structuredClone(nextEdges) }
    const current = historyRef.current[historyIndexRef.current]
    if (current && JSON.stringify(current) === JSON.stringify(snapshot)) return
    historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1)
    historyRef.current.push(snapshot)
    if (historyRef.current.length > 50) historyRef.current.shift()
    historyIndexRef.current = historyRef.current.length - 1
    setHistoryVersion((value) => value + 1)
  }, [])

  useEffect(() => {
    if (!historyReadyRef.current) {
      historyReadyRef.current = true
      pushHistory([], [])
    }
  }, [pushHistory])

  useEffect(() => {
    if (historyReadyRef.current && !isNodeDragging.current) pushHistory(nodes, edges)
  }, [nodes, edges, pushHistory])

  const restoreHistory = useCallback((index: number) => {
    const snapshot = historyRef.current[index]
    if (!snapshot) return
    restoringHistoryRef.current = true
    setNodes(structuredClone(snapshot.nodes))
    setEdges(structuredClone(snapshot.edges))
    historyIndexRef.current = index
    setHistoryVersion((value) => value + 1)
    requestAnimationFrame(() => { restoringHistoryRef.current = false })
  }, [setNodes, setEdges])

  const undo = useCallback(() => restoreHistory(historyIndexRef.current - 1), [restoreHistory])
  const redo = useCallback(() => restoreHistory(historyIndexRef.current + 1), [restoreHistory])

  useEffect(() => {
    const handleHistoryKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z") return
      const target = event.target as HTMLElement
      if (target.isContentEditable || ["INPUT", "TEXTAREA"].includes(target.tagName)) return
      event.preventDefault()
      if (event.shiftKey) redo()
      else undo()
    }
    window.addEventListener("keydown", handleHistoryKey)
    return () => window.removeEventListener("keydown", handleHistoryKey)
  }, [undo, redo])

  // Auto-save to localStorage
  useEffect(() => {
    if (nodes.length > 0 || edges.length > 0) {
      localStorage.setItem("cyber-graph-data", JSON.stringify({ nodes, edges, useTidyEdges }))
    }
  }, [nodes, edges, useTidyEdges])

  const onConnectStart = useCallback((_: unknown, params: { nodeId: string | null }) => {
    connectionStartNodeId.current = params.nodeId
  }, [])

  const onConnectEnd = useCallback(() => {
    connectionStartNodeId.current = null
  }, [])

  const onConnect = useCallback(
    (connection: Connection) => {
      const startNodeId = connectionStartNodeId.current
      const normalizedConnection =
        startNodeId && connection.target === startNodeId
          ? { ...connection, source: connection.target, target: connection.source }
          : connection
      const newEdge = {
        ...normalizedConnection,
        type: useTidyEdges ? "smoothstep" : "crossing",
        data: { useSmoothStep: useTidyEdges, routePoints: [] },
      }
      setEdges((eds) => addEdge(newEdge, eds))
      connectionStartNodeId.current = null
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
          sourceHandle: "bottom-source",
          targetHandle: "top-target",
          ...defaultEdgeOptions,
          type: useTidyEdges ? "smoothstep" : "crossing",
          data: { useSmoothStep: useTidyEdges, routePoints: [] },
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

  const onNodeDragStart = useCallback((event: React.MouseEvent, node: Node<CyberNodeData>) => {
    const nodeIds = selectedNodes.has(node.id) ? Array.from(selectedNodes) : [node.id]
    const draggedNodes = nodes.filter((item) => nodeIds.includes(item.id))
    const pointer = reactFlowInstance?.screenToFlowPosition({ x: event.clientX, y: event.clientY }) ?? node.position
    nodeDragSession.current = {
      nodeIds,
      startPositions: Object.fromEntries(draggedNodes.map((item) => [item.id, { ...item.position }])),
      anchorId: node.id,
      anchorStart: { ...node.position },
      pointerOffset: { x: pointer.x - node.position.x, y: pointer.y - node.position.y },
      axis: null,
      shiftState: event.shiftKey,
    }
    isNodeDragging.current = true
    setAlignmentGuide(null)
  }, [nodes, selectedNodes, reactFlowInstance])

  const onNodeDrag = useCallback((_event: React.MouseEvent, node: Node<CyberNodeData>) => {
    // React Flow owns the authoritative drag position. This callback only derives
    // alignment feedback; it never writes node positions, preventing release drift.
    const session = nodeDragSession.current
    if (!session || !reactFlowInstance) return
    const movingWidth = node.measured?.width ?? node.width ?? 0
    const movingHeight = node.measured?.height ?? node.height ?? 0
    const threshold = 8 / reactFlowInstance.getZoom()
    const others = nodes.filter((item) => !session.nodeIds.includes(item.id))
    let best: { axis: "vertical" | "horizontal"; coordinate: number; distance: number } | null = null
    for (const other of others) {
      const width = other.measured?.width ?? other.width ?? movingWidth
      const height = other.measured?.height ?? other.height ?? movingHeight
      const verticalDistance = Math.abs(node.position.x + movingWidth / 2 - (other.position.x + width / 2))
      const horizontalDistance = Math.abs(node.position.y + movingHeight / 2 - (other.position.y + height / 2))
      if (verticalDistance <= threshold && (!best || verticalDistance < best.distance)) best = { axis: "vertical", coordinate: other.position.x + width / 2, distance: verticalDistance }
      if (horizontalDistance <= threshold && (!best || horizontalDistance < best.distance)) best = { axis: "horizontal", coordinate: other.position.y + height / 2, distance: horizontalDistance }
    }
    setAlignmentGuide(best ? { axis: best.axis, coordinate: best.coordinate } : null)
  }, [nodes, reactFlowInstance])

  const onNodeDragStop = useCallback(() => {
    nodeDragSession.current = null
    isNodeDragging.current = false
    setAlignmentGuide(null)
  }, [])

  const handleNodesChange = useCallback((changes: NodeChange<Node<CyberNodeData>>[]) => {
    const session = nodeDragSession.current
    if (!session) {
      onNodesChange(changes)
      return
    }

    const positionChanges = changes.filter((change): change is Extract<NodeChange<Node<CyberNodeData>>, { type: "position" }> => change.type === "position" && Boolean(change.position))
    const anchorChange = positionChanges.find((change) => change.id === session.anchorId)
    const anchorNode = nodes.find((node) => node.id === session.anchorId)
    const zoom = reactFlowInstance?.getZoom() ?? 1
    const snapThreshold = 8 / zoom
    let snapDelta: XYPosition | null = null

    if (anchorChange?.position && anchorNode && reactFlowInstance) {
      const anchorWidth = anchorNode.measured?.width ?? anchorNode.width ?? 0
      const anchorHeight = anchorNode.measured?.height ?? anchorNode.height ?? 0
      const anchorCenter = {
        x: anchorChange.position.x + anchorWidth / 2,
        y: anchorChange.position.y + anchorHeight / 2,
      }
      const others = nodes.filter((node) => !session.nodeIds.includes(node.id))
      let best: { axis: "x" | "y"; delta: number; distance: number } | null = null
      for (const other of others) {
        const width = other.measured?.width ?? other.width ?? anchorWidth
        const height = other.measured?.height ?? other.height ?? anchorHeight
        const xDelta = other.position.x + width / 2 - anchorCenter.x
        const yDelta = other.position.y + height / 2 - anchorCenter.y
        if (Math.abs(xDelta) <= snapThreshold && (!best || Math.abs(xDelta) < best.distance)) best = { axis: "x", delta: xDelta, distance: Math.abs(xDelta) }
        if (Math.abs(yDelta) <= snapThreshold && (!best || Math.abs(yDelta) < best.distance)) best = { axis: "y", delta: yDelta, distance: Math.abs(yDelta) }
      }
      if (best && (!isShiftHeld || !session.axis || (session.axis === "x" && best.axis === "x") || (session.axis === "y" && best.axis === "y"))) {
        snapDelta = best.axis === "x" ? { x: best.delta, y: 0 } : { x: 0, y: best.delta }
        setAlignmentGuide({ axis: best.axis === "x" ? "vertical" : "horizontal", coordinate: best.axis === "x" ? anchorCenter.x + best.delta : anchorCenter.y + best.delta })
      }
    }

    if (!isShiftHeld) {
      onNodesChange(snapDelta ? changes.map((change) => {
        if (change.type !== "position" || !change.position) return change
        return { ...change, position: { x: change.position.x + snapDelta!.x, y: change.position.y + snapDelta!.y } }
      }) : changes)
      return
    }

    if (anchorChange?.type === "position" && anchorChange.position) {
      const deltaX = anchorChange.position.x - session.anchorStart.x
      const deltaY = anchorChange.position.y - session.anchorStart.y
      if (!session.axis && (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2)) {
        session.axis = Math.abs(deltaX) >= Math.abs(deltaY) ? "x" : "y"
      }
    }

    const constrained = changes.map((change) => {
      if (change.type !== "position" || !change.position) return change
      const start = session.startPositions[change.id]
      const position = {
        x: change.position.x + (snapDelta?.x ?? 0),
        y: change.position.y + (snapDelta?.y ?? 0),
      }
      if (!start || !session.axis) return { ...change, position }
      return {
        ...change,
        position: session.axis === "x"
          ? { x: position.x, y: start.y }
          : { x: start.x, y: position.y },
      }
    })
    onNodesChange(constrained)
  }, [isShiftHeld, onNodesChange])

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

      // Escape clears selection and closes modals/panels
      if (e.key === "Escape" && !isInput) {
        if (snapshotModal) {
          setSnapshotModal(false)
        } else if (bulkDeleteModal) {
          setBulkDeleteModal(false)
        } else if (deleteConfirmNodeId) {
          setDeleteConfirmNodeId(null)
        } else if (clearCanvasModal) {
          setClearCanvasModal(false)
        } else if (showHelp) {
          setShowHelp(false)
        } else {
          setSelectedNode(null)
          setSelectedNodes(new Set())
          setContextMenu(null)
        }
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
  }, [selectedNode, selectedNodes, requestDeleteNode, snapshotModal, bulkDeleteModal, deleteConfirmNodeId, clearCanvasModal, showHelp])

  useEffect(() => {
    if (!showHelp) return

    const handleOutsidePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Node && helpContainerRef.current?.contains(target)) return
      setShowHelp(false)
    }

    document.addEventListener("pointerdown", handleOutsidePointerDown)
    return () => document.removeEventListener("pointerdown", handleOutsidePointerDown)
  }, [showHelp])

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

  const importJsonFile = useCallback((file: File) => {
    if (!file.name.toLowerCase().endsWith(".json") && file.type !== "application/json") {
      toast({ title: "Unsupported file", description: "Please drop a JSON file.", variant: "destructive" })
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string)
        if (!Array.isArray(data?.nodes) || !Array.isArray(data?.edges)) {
          throw new Error("Invalid graph structure")
        }

        const updatedNodes = data.nodes.map((node: Node<CyberNodeData>) => ({
          ...node,
          data: {
            ...node.data,
            status: String(node.data.status) === "not-yet" ? "default" :
              String(node.data.status) === "running" ? "in-progress" :
                String(node.data.status) === "queued" ? "pending" :
                  String(node.data.status) === "pwned" ? "success" :
                    String(node.data.status) === "false-positive" ? "failed" :
                      String(node.data.status) === "exploitable" ? "failed" :
                        String(node.data.status) === "needs-review" ? "pending" :
                          node.data.status || "default"
          }
        }))
        setNodes(updatedNodes)

        const tidyMode = data.useTidyEdges ?? false
        setEdges(data.edges.map((edge: Edge) => ({
          ...edge,
          type: tidyMode ? "smoothstep" : "crossing",
          data: { ...edge.data, useSmoothStep: tidyMode },
        })))
        if (data.useTidyEdges !== undefined) setUseTidyEdges(data.useTidyEdges)
        toast({ title: "Graph imported", description: `${updatedNodes.length} nodes loaded.` })
      } catch {
        toast({ title: "Import failed", description: "The file is not a valid graph JSON file.", variant: "destructive" })
      }
    }
    reader.onerror = () => toast({ title: "Import failed", description: "The file could not be read.", variant: "destructive" })
    reader.readAsText(file)
  }, [setNodes, setEdges])

  // Import function
  const handleImport = useCallback(() => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".json,application/json"
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) importJsonFile(file)
    }
    input.click()
  }, [importJsonFile])

  const resetFileDrag = useCallback(() => {
    fileDragDepth.current = 0
    setFileDragState("idle")
  }, [])

  const handleCanvasDragEnter = useCallback((event: React.DragEvent) => {
    const fileItems = Array.from(event.dataTransfer.items).filter((item) => item.kind === "file")
    if (fileItems.length === 0) return
    event.preventDefault()
    fileDragDepth.current += 1
    setFileDragState(fileItems.every((item) => item.type === "application/json" || item.type === "") ? "valid" : "invalid")
  }, [])

  const handleCanvasDragOver = useCallback((event: React.DragEvent) => {
    const fileItems = Array.from(event.dataTransfer.items).filter((item) => item.kind === "file")
    if (fileItems.length === 0) return
    event.preventDefault()
    event.dataTransfer.dropEffect = "copy"
    setFileDragState(fileItems.every((item) => item.type === "application/json" || item.type === "") ? "valid" : "invalid")
  }, [])

  const handleCanvasDragLeave = useCallback((event: React.DragEvent) => {
    if (!Array.from(event.dataTransfer.items).some((item) => item.kind === "file")) return
    fileDragDepth.current = Math.max(0, fileDragDepth.current - 1)
    if (fileDragDepth.current === 0) setFileDragState("idle")
  }, [])

  const handleCanvasDrop = useCallback((event: React.DragEvent) => {
    if (!Array.from(event.dataTransfer.items).some((item) => item.kind === "file")) return
    event.preventDefault()
    const file = event.dataTransfer.files[0]
    resetFileDrag()
    if (file) importJsonFile(file)
  }, [importJsonFile, resetFileDrag])

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
      onDragEnter={handleCanvasDragEnter}
      onDragOver={handleCanvasDragOver}
      onDragLeave={handleCanvasDragLeave}
      onDrop={handleCanvasDrop}
      style={{ cursor: isShiftHeld ? 'crosshair' : 'grab' }}
    >
      {alignmentGuide && reactFlowInstance && (() => {
        const guide = reactFlowInstance.flowToScreenPosition(
          alignmentGuide.axis === "vertical"
            ? { x: alignmentGuide.coordinate, y: 0 }
            : { x: 0, y: alignmentGuide.coordinate }
        )
        return (
          <div
            className="pointer-events-none absolute z-40 border-primary/60"
            style={alignmentGuide.axis === "vertical"
              ? { left: guide.x, top: 0, bottom: 0, borderLeftWidth: 1, borderLeftStyle: "dashed" }
              : { top: guide.y, left: 0, right: 0, borderTopWidth: 1, borderTopStyle: "dashed" }}
          />
        )
      })()}

      {fileDragState !== "idle" && (
        <div className="pointer-events-none absolute inset-4 z-[60] flex items-center justify-center rounded-xl border-2 border-dashed bg-background/70 backdrop-blur-sm">
          <div className={cn(
            "rounded-lg border px-6 py-4 text-center shadow-lg",
            fileDragState === "valid"
              ? "border-primary bg-primary/10 text-primary"
              : "border-destructive bg-destructive/10 text-destructive"
          )}>
            <p className="font-mono text-sm font-semibold">
              {fileDragState === "valid" ? "Drop JSON to import" : "Unsupported file type"}
            </p>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              {fileDragState === "valid" ? "Release anywhere on the canvas" : "Only .json graph files can be imported"}
            </p>
          </div>
        </div>
      )}

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
                                          ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣼⣞⡿⣞⡅⠀⠀⠀⠀⠘⠏⠓⠒⠒⠀⠀⠀⠀⠀��
                                          ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣰⣟⢾⣽⢫⡿⠀⠀⠀⠀⠀���⠀⠀⠀⠀⠀⠀⠀⠀⠀
                                          ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣠⢤⣶⡻⣞⣿⣺⢯⣽⣳⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
                                          ⠀⠀⠀⠀⠀⠀⠀⠀⢠⣄⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣀⣠⣤⣿⣽⣻⢾⣽⣷⣾⣽⣻⣞⣷⣳⡄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
                                          ⠀⠀⠀⠀⠀⠀⠀⠀⠈⢻⣿⣶⣄⡀⠀⠀⠀⣀⣲⣴⢶⣞⡿⣽⣞⡷⣯⢿⡽⣞⣿⠟⠋⠁⠉⠈⠳⣟⣆⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
                                          ⠀⠀⠀���⠀⠀⠀⠀⠀⠀⢻⣿⣿⣿⣿⢶⣾⣿⡽⣯⣟⡾⣽⡷⣯⣟⡽⡾⣽⡯⠁⠀⠀⠀⠀⠀⠀⢮⣭⣦⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀
                                          ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠉⢞⣿⣿⢯⡿⣿⣯⣟⣷⣯⢿⣳⣟⡷⣽⣼⣻⣽⠀⠀⠀⠀⠀⠀⠀⢀⣼⡯⡗⠋⠤⠀⠀⠀⠀⠀⠀⠀⠀
                                          ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢾⣿⣿⣯⣽⣾⣿⣾⣗⡿⣯⡷⣯⣟⡷⣞⣼⣿⣀⠀⠀⠀⠀⢀⣠⡿⣏⡗⠈⠐⠈⠅⠀⠀⠀⠀⠀⠀⠀
                                          ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣼⠛⠏⠉⠉⠽⢟⢿⣿⣿⣿⣿⣷⣻⢾⡽⣞⡷⠄⡹⣶⢿⣻⢿⣻⡽⢯⣼⢦⠶⠁⠈⠀⠀⠀⠀⠀⠀⠀
                                          ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣸⣯⠇⠀⠀⠀⠀⠀⠁⣽⣿⣿⣿⣷⣯⣿⣽⣛⡦⠀⠀⢩⣿⣹⢯⣷⢻⣟⠺⢣⡖⣘⠤⠓⠀⠀⠀⠀⠀⠀
                                          ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢈⣿⡃⠁⠀⠀⠀⢀⣤⣾⣟⢿⣻⣿⣿⣟⡾⣽⡳⠄⠎⢳⣯⢯⣟⡾⢯⣞⣯⣓⠉⢀⠀⠀⡄⢢⡀⠀⠀⠀
                                          ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣸⣷⣷⣶⣳⣶⣺⣿⣿⣳⢯⣟⣿⣿⣳⢯⠛⠅⠃⠀⠀⣴⣿⡿⣬⢶⠾⠙⣊⣥⠾⡒⠊⢁⢠⠣⣌⠀⠀⠀
                                          ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢺⡽⣾⡽⣯⣟⣿⡿⣯⣿⣿⣾⢿⣿⠳⢏⣈⢠⠀⠀⣰⢿⡿⣽⣉⡶⠌⠋⠉⣀⡀⠁⠀⠀⠀⣘⡐⣂⠀⠀
                                          ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠘⣽⣳⣟⣳⣟⣾⣽⣿⣿⣿⣿⣿⣦⣜⡻⡽⠆⠧⣴⡟⣯⢟⡳⣭⠲⠄⠐⠀⠀⠀⠈⠁⠉⠑⢊⡕⢃⠄⠀
                                          ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠹⣿⣾⣿⣯⣿⣾⣿⣿⣿⣿⣿⣿⣿⣿⣾��⠀⠹⠾⡵⡞⡽⢢⣃⠐⠀⠀⠄⡐⠀⠀⠀⡘⢦⠘⣌⠀⠀
                                          ⠀�����⠀⠀⠀⠀⠀⠀⠀⠀⠐⠹⢿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⢯⡏⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣀⠒⡈⠀⡀⠄⡑⠢⣉⠴⣈⣆
                                          ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣀⠻⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⢯⣏⡴⣶⣵⣢⢤⢠⡀⡄⢠⠐⡰⢌⡱⠀⡁⡀⠆⡥⠆⡥⣛⡽⣾
                                          ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⡀⠔⠉⠀⠀⢽⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣼⣻⢷⣯⡽⣞⣷⣻⡼⣡⢋⡔⠣⠜⡐⢐⠠⡓⣤⣙⣲⣽⣻⢷
                                          ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠘⢿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣷⡿⣽⣞⣷⣻⡴⣣⢜⡱⣊⡕⣊⠠⡙⡰⣭⢷⣯⣿⢿
                                                        

  /$$$$$$                     /$$      /$$ /$$   /$$ /$$$$$$$$ /$$$$$$$  /$$$$$$$$       /$$      /$$  /$$$$$$   /$$$$$$        /$$$$$$        /$$$$ 
 /$$__  $$                   | $$  /$ | $$| $$  | $$| $$_____/| $$__  $$| $$_____/      | $$  /$ | $$ /$$__  $$ /$$__  $$      |_  $$_/       /$$$$
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
        edges={edges.map((edge) => {
          const isOutgoing = selectedNode?.id === edge.source
          const isIncoming = selectedNode?.id === edge.target
          return {
            ...edge,
            style: {
              ...edge.style,
              stroke: isOutgoing ? "var(--primary)" : isIncoming ? "var(--muted-foreground)" : "var(--border)",
              strokeWidth: isOutgoing ? 3 : 2,
              opacity: selectedNode && !isOutgoing && !isIncoming ? 0.35 : 1,
            },
            markerEnd: edge.markerEnd && typeof edge.markerEnd === "object" ? {
              ...edge.markerEnd,
              color: isOutgoing ? "var(--primary)" : "var(--border)",
            } : edge.markerEnd,
          }
        })}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        onConnect={onConnect}
        onInit={setReactFlowInstance}
        onNodeContextMenu={onNodeContextMenu}
        onEdgeContextMenu={onEdgeContextMenu}
        onPaneContextMenu={onPaneContextMenu}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onNodeDragStart={onNodeDragStart}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
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
      <div ref={helpContainerRef} className="absolute bottom-4 left-4 z-10">
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
          {/* Header Row */}
          <div className="mb-3 flex items-center justify-between">
            <h4 className="font-mono text-sm font-semibold text-foreground">
              Quick Guide
            </h4>

            <span className="font-mono text-[10px] font-semibold text-primary tracking-wide animate-pulse">
              {APP_VERSION}
            </span>
          </div>

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
          className="flex items-center justify-center rounded border border-border bg-card/80 p-1.5 text-muted-foreground backdrop-blur-sm transition-colors hover:bg-muted hover:text-foreground"
          title="Take a snapshot of the canvas"
        >
          <Camera size={14} />
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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter") handleBulkDelete()
            if (e.key === "Escape") setBulkDeleteModal(false)
          }}
        >
          <div className="rounded-lg border border-border bg-card p-6 shadow-xl max-w-sm mx-4" tabIndex={-1} ref={(el) => el?.focus()}>
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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter") handleConfirmDeleteNode()
            if (e.key === "Escape") setDeleteConfirmNodeId(null)
          }}
        >
          <div className="rounded-lg border border-border bg-card p-6 shadow-xl max-w-sm mx-4" tabIndex={-1} ref={(el) => el?.focus()}>
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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter") handleClearCanvas()
            if (e.key === "Escape") setClearCanvasModal(false)
          }}
        >
          <div className="rounded-lg border border-border bg-card p-6 shadow-xl max-w-sm mx-4" tabIndex={-1} ref={(el) => el?.focus()}>
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
