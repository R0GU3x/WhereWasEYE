import { useCallback, useRef, useState } from 'react'
import type { Node, Edge } from '@xyflow/react'
import type { CyberNodeData } from '@/components/graph/cyber-node'

export interface GraphState {
  nodes: Node<CyberNodeData>[]
  edges: Edge[]
  useTidyEdges: boolean
}

export interface HistoryAction {
  state: GraphState
  description: string
  timestamp: number
}

interface UseHistoryReturn {
  canUndo: boolean
  canRedo: boolean
  undo: () => GraphState | null
  redo: () => GraphState | null
  push: (state: GraphState, description: string) => void
  clear: () => void
  getCurrentState: () => HistoryAction | null
}

export function useHistory(maxSize: number = 50): UseHistoryReturn {
  const historyStack = useRef<HistoryAction[]>([])
  const currentIndex = useRef<number>(-1)
  const [, forceUpdate] = useState({})

  const notifyChange = useCallback(() => {
    forceUpdate({})
  }, [])

  const push = useCallback(
    (state: GraphState, description: string) => {
      // Remove any redo history after current index
      historyStack.current = historyStack.current.slice(0, currentIndex.current + 1)

      // Add new state
      historyStack.current.push({
        state,
        description,
        timestamp: Date.now(),
      })

      // Limit history size
      if (historyStack.current.length > maxSize) {
        historyStack.current.shift()
      } else {
        currentIndex.current++
      }

      notifyChange()
    },
    [maxSize, notifyChange]
  )

  const undo = useCallback((): GraphState | null => {
    if (currentIndex.current > 0) {
      currentIndex.current--
      notifyChange()
      return historyStack.current[currentIndex.current]?.state || null
    }
    return null
  }, [notifyChange])

  const redo = useCallback((): GraphState | null => {
    if (currentIndex.current < historyStack.current.length - 1) {
      currentIndex.current++
      notifyChange()
      return historyStack.current[currentIndex.current]?.state || null
    }
    return null
  }, [notifyChange])

  const clear = useCallback(() => {
    historyStack.current = []
    currentIndex.current = -1
    notifyChange()
  }, [notifyChange])

  const canUndo = currentIndex.current > 0
  const canRedo = currentIndex.current < historyStack.current.length - 1

  const getCurrentState = useCallback(
    (): HistoryAction | null => {
      if (currentIndex.current >= 0 && currentIndex.current < historyStack.current.length) {
        return historyStack.current[currentIndex.current]
      }
      return null
    },
    []
  )

  return {
    canUndo,
    canRedo,
    undo,
    redo,
    push,
    clear,
    getCurrentState,
  }
}
