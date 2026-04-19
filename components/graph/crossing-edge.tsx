"use client"

import { memo, useMemo } from "react"
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  getSmoothStepPath,
  useReactFlow,
  type EdgeProps,
} from "@xyflow/react"

// Helper to check if two line segments intersect
function lineSegmentIntersection(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  p4: { x: number; y: number }
): { x: number; y: number } | null {
  const denom = (p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y)
  if (Math.abs(denom) < 0.0001) return null // parallel lines

  const ua = ((p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x)) / denom
  const ub = ((p2.x - p1.x) * (p1.y - p3.y) - (p2.y - p1.y) * (p1.x - p3.x)) / denom

  if (ua > 0.05 && ua < 0.95 && ub > 0.05 && ub < 0.95) {
    return {
      x: p1.x + ua * (p2.x - p1.x),
      y: p1.y + ua * (p2.y - p1.y),
    }
  }
  return null
}

// Get points along a bezier curve
function getBezierPoints(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  segments: number = 10
): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = []
  const midY = (sourceY + targetY) / 2
  
  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    // Approximate bezier curve points
    const x = sourceX + (targetX - sourceX) * t
    const y = sourceY + (midY - sourceY) * 2 * t * (1 - t) + (targetY - sourceY) * t * t
    points.push({ x, y })
  }
  return points
}

// Get points along a smoothstep path
function getSmoothStepPoints(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number
): { x: number; y: number }[] {
  const midY = (sourceY + targetY) / 2
  return [
    { x: sourceX, y: sourceY },
    { x: sourceX, y: midY },
    { x: targetX, y: midY },
    { x: targetX, y: targetY },
  ]
}

interface CrossingEdgeProps extends EdgeProps {
  data?: {
    useSmoothStep?: boolean
  }
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
  const { getEdges, getNodes } = useReactFlow()
  const useSmoothStep = data?.useSmoothStep ?? false

  const [edgePath] = useSmoothStep
    ? getSmoothStepPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
        borderRadius: 8,
      })
    : getBezierPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
      })

  // Find crossing points with other edges
  const crossingPoints = useMemo(() => {
    const edges = getEdges()
    const nodes = getNodes()
    const crossings: { x: number; y: number }[] = []

    // Get node positions for edge source/target mapping
    const nodePositions = new Map(
      nodes.map((n) => [
        n.id,
        {
          x: n.position.x + 70, // center of node (assuming ~140px width)
          y: n.position.y + 30, // center of node (assuming ~60px height)
        },
      ])
    )

    // Get points for current edge
    const currentPoints = useSmoothStep
      ? getSmoothStepPoints(sourceX, sourceY, targetX, targetY)
      : getBezierPoints(sourceX, sourceY, targetX, targetY)

    // Check against all other edges
    edges.forEach((edge) => {
      if (edge.id === id) return

      const edgeSource = nodePositions.get(edge.source)
      const edgeTarget = nodePositions.get(edge.target)
      if (!edgeSource || !edgeTarget) return

      // Adjust for handle positions (top/bottom)
      const otherSourceY = edgeSource.y + 30 // bottom handle
      const otherTargetY = edgeTarget.y - 30 // top handle

      const otherPoints = useSmoothStep
        ? getSmoothStepPoints(edgeSource.x, otherSourceY, edgeTarget.x, otherTargetY)
        : getBezierPoints(edgeSource.x, otherSourceY, edgeTarget.x, otherTargetY)

      // Check all segment pairs for intersections
      for (let i = 0; i < currentPoints.length - 1; i++) {
        for (let j = 0; j < otherPoints.length - 1; j++) {
          const intersection = lineSegmentIntersection(
            currentPoints[i],
            currentPoints[i + 1],
            otherPoints[j],
            otherPoints[j + 1]
          )
          if (intersection) {
            // Avoid duplicate points
            const isDuplicate = crossings.some(
              (c) => Math.abs(c.x - intersection.x) < 10 && Math.abs(c.y - intersection.y) < 10
            )
            if (!isDuplicate) {
              crossings.push(intersection)
            }
          }
        }
      }
    })

    return crossings
  }, [getEdges, getNodes, id, sourceX, sourceY, targetX, targetY, useSmoothStep])

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
      <EdgeLabelRenderer>
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
            {/* Small bridge/arc indicator */}
            <div className="h-3 w-3 rounded-full border-2 border-primary bg-background" />
          </div>
        ))}
      </EdgeLabelRenderer>
    </>
  )
}

export const CrossingEdge = memo(CrossingEdgeComponent)
