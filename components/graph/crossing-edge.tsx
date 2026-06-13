"use client"

import { useState, useCallback, useMemo, memo } from 'react'
import { BaseEdge, EdgeLabelRenderer, useReactFlow, type EdgeProps } from '@xyflow/react'
import { getBezierPath, getSmoothStepPath } from '@xyflow/react'

interface CrossingEdgeProps extends EdgeProps {
  data?: {
    useSmoothStep?: boolean
    isHighlighted?: boolean
    bendPoints?: Array<{ x: number; y: number }>
  }
}

// Helper function to generate orthogonal path with bend points
function generateOrthogonalPath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  bendPoints: Array<{ x: number; y: number }>
): string {
  if (bendPoints.length === 0) {
    // Default orthogonal routing with middle bend
    const midX = sourceX + (targetX - sourceX) / 2
    return `M ${sourceX} ${sourceY} L ${midX} ${sourceY} L ${midX} ${targetY} L ${targetX} ${targetY}`
  }

  // Build path through bend points with strict 90° angles
  let path = `M ${sourceX} ${sourceY}`
  let lastX = sourceX
  let lastY = sourceY

  for (let i = 0; i < bendPoints.length; i++) {
    const bend = bendPoints[i]
    // Alternate between horizontal and vertical movements for orthogonal routing
    if (i % 2 === 0) {
      // Move horizontally first, then vertically
      path += ` L ${bend.x} ${lastY} L ${bend.x} ${bend.y}`
    } else {
      // Move vertically first, then horizontally
      path += ` L ${lastX} ${bend.y} L ${bend.x} ${bend.y}`
    }
    lastX = bend.x
    lastY = bend.y
  }

  // Final segment to target with orthogonal routing
  if (bendPoints.length % 2 === 0) {
    path += ` L ${lastX} ${targetY} L ${targetX} ${targetY}`
  } else {
    path += ` L ${targetX} ${lastY} L ${targetX} ${targetY}`
  }

  return path
}

function CrossingEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  data,
}: CrossingEdgeProps) {
  const { getEdges, getNodes, setEdges } = useReactFlow()
  const useSmoothStep = data?.useSmoothStep ?? false
  const isHighlighted = data?.isHighlighted ?? false
  const bendPoints = data?.bendPoints ?? []
  const [isDraggingBend, setIsDraggingBend] = useState<number | null>(null)

  // Apply highlight styles
  const highlightedStyle = isHighlighted ? {
    ...style,
    stroke: "oklch(0.7 0.2 180)",
    strokeWidth: 4,
    opacity: 1,
  } : style

  const highlightedMarkerEnd = isHighlighted ? {
    ...markerEnd,
    color: "oklch(0.7 0.2 180)",
  } : markerEnd

  // Generate path based on routing type
  const edgePath = useMemo(() => {
    if (bendPoints.length > 0) {
      return generateOrthogonalPath(sourceX, sourceY, targetX, targetY, bendPoints)
    } else if (useSmoothStep) {
      const [path] = getSmoothStepPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
        borderRadius: 8,
      })
      return path
    } else {
      const [path] = getBezierPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
      })
      return path
    }
  }, [bendPoints, useSmoothStep, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition])

  // Calculate crossing points (skip if using custom routing)
  const crossingPoints = useMemo(() => {
    const crossings: Array<{ x: number; y: number }> = []

    if (bendPoints.length > 0) return crossings

    const allEdges = getEdges()
    const thisEdge = allEdges.find((e) => e.id === id)
    if (!thisEdge) return crossings

    const nodes = getNodes()

    for (const edge of allEdges) {
      if (edge.id === id) continue

      const edgeSourceNode = nodes.find((n) => n.id === edge.source)
      const edgeTargetNode = nodes.find((n) => n.id === edge.target)

      if (edgeSourceNode && edgeTargetNode) {
        const ex1 = edgeSourceNode.position?.x || 0
        const ey1 = edgeSourceNode.position?.y || 0
        const ex2 = edgeTargetNode.position?.x || 0
        const ey2 = edgeTargetNode.position?.y || 0

        const minX = Math.min(sourceX, targetX)
        const maxX = Math.max(sourceX, targetX)
        const minY = Math.min(sourceY, targetY)
        const maxY = Math.max(sourceY, targetY)

        const eMinX = Math.min(ex1, ex2)
        const eMaxX = Math.max(ex1, ex2)
        const eMinY = Math.min(ey1, ey2)
        const eMaxY = Math.max(ey1, ey2)

        if (minX <= eMaxX && maxX >= eMinX && minY <= eMaxY && maxY >= eMinY) {
          crossings.push({
            x: (minX + maxX) / 2,
            y: (minY + maxY) / 2,
          })
        }
      }
    }

    return crossings
  }, [getEdges, getNodes, id, sourceX, sourceY, targetX, targetY, bendPoints])

  // Handle bend point dragging
  const handleBendMouseDown = useCallback((index: number, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingBend(index)
  }, [])

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={highlightedMarkerEnd} style={highlightedStyle} />
      <EdgeLabelRenderer>
        {/* Crossing point indicators */}
        {crossingPoints.map((point, index) => (
          <div
            key={`${id}-crossing-${index}`}
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${point.x}px, ${point.y}px)`,
              pointerEvents: "none",
            }}
            className="flex items-center justify-center"
          >
            <div className="h-3 w-3 rounded-full border-2 border-primary bg-background" />
          </div>
        ))}
        
        {/* Draggable bend points for orthogonal routing */}
        {bendPoints.map((point, index) => (
          <div
            key={`${id}-bend-${index}`}
            onMouseDown={(e) => handleBendMouseDown(index, e)}
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${point.x}px, ${point.y}px)`,
              cursor: "grab",
              width: "12px",
              height: "12px",
            }}
            className="flex items-center justify-center rounded-full border-2 border-accent bg-card hover:bg-accent/20 active:cursor-grabbing"
            title={`Bend point ${index + 1} - drag to adjust routing`}
          />
        ))}
      </EdgeLabelRenderer>
    </>
  )
}

export const CrossingEdge = memo(CrossingEdgeComponent)
