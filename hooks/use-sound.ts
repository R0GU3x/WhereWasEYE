"use client"

import { useCallback, useEffect, useRef, useState } from "react"

export type SoundType =
  | "nodeCreate"
  | "nodeDelete"
  | "edgeConnect"
  | "edgeDisconnect"
  | "statusChange"
  | "click"
  | "success"
  | "error"

const SOUND_CONFIG: Record<SoundType, { frequency: number; duration: number; type: OscillatorType; gain: number }> = {
  nodeCreate: { frequency: 520, duration: 80, type: "sine", gain: 0.12 },
  nodeDelete: { frequency: 280, duration: 120, type: "sawtooth", gain: 0.08 },
  edgeConnect: { frequency: 660, duration: 60, type: "sine", gain: 0.1 },
  edgeDisconnect: { frequency: 330, duration: 100, type: "triangle", gain: 0.08 },
  statusChange: { frequency: 440, duration: 50, type: "sine", gain: 0.1 },
  click: { frequency: 800, duration: 30, type: "sine", gain: 0.06 },
  success: { frequency: 880, duration: 150, type: "sine", gain: 0.1 },
  error: { frequency: 200, duration: 200, type: "sawtooth", gain: 0.08 },
}

const STORAGE_KEY = "cyber-graph-sound-enabled"

export function useSound() {
  const [soundEnabled, setSoundEnabled] = useState(false)
  const audioContextRef = useRef<AudioContext | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored !== null) {
      setSoundEnabled(stored === "true")
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(soundEnabled))
  }, [soundEnabled])

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext()
    }
    return audioContextRef.current
  }, [])

  const playSound = useCallback(
    (type: SoundType) => {
      if (!soundEnabled) return

      try {
        const ctx = getAudioContext()
        const config = SOUND_CONFIG[type]

        const oscillator = ctx.createOscillator()
        const gainNode = ctx.createGain()

        oscillator.type = config.type
        oscillator.frequency.setValueAtTime(config.frequency, ctx.currentTime)

        gainNode.gain.setValueAtTime(config.gain, ctx.currentTime)
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + config.duration / 1000)

        oscillator.connect(gainNode)
        gainNode.connect(ctx.destination)

        oscillator.start(ctx.currentTime)
        oscillator.stop(ctx.currentTime + config.duration / 1000)
      } catch {
        // Audio not supported
      }
    },
    [soundEnabled, getAudioContext]
  )

  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => !prev)
  }, [])

  return { soundEnabled, toggleSound, playSound }
}
