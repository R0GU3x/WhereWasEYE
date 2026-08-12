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
  | "snap"
  | "undo"
  | "redo"

type SoundConfig = {
  frequency: number
  duration: number
  type: OscillatorType
  gain: number
  harmonic?: number
  cooldown?: number
  slide?: number
}

const SOUND_CONFIG: Record<SoundType, SoundConfig> = {
  nodeCreate: { frequency: 520, duration: 72, type: "sine", gain: 0.07, harmonic: 1.5, cooldown: 55, slide: 0.9 },
  nodeDelete: { frequency: 250, duration: 86, type: "triangle", gain: 0.045, cooldown: 55, slide: 0.68 },
  edgeConnect: { frequency: 640, duration: 62, type: "sine", gain: 0.06, harmonic: 2, cooldown: 55, slide: 1.04 },
  edgeDisconnect: { frequency: 320, duration: 78, type: "triangle", gain: 0.045, cooldown: 55, slide: 0.76 },
  statusChange: { frequency: 440, duration: 52, type: "sine", gain: 0.055, cooldown: 45, slide: 0.94 },
  click: { frequency: 800, duration: 28, type: "sine", gain: 0.03, cooldown: 45, slide: 0.82 },
  success: { frequency: 880, duration: 110, type: "sine", gain: 0.055, harmonic: 1.5, cooldown: 80, slide: 1.02 },
  error: { frequency: 200, duration: 140, type: "triangle", gain: 0.045, cooldown: 100, slide: 0.7 },
  snap: { frequency: 740, duration: 68, type: "triangle", gain: 0.06, harmonic: 2.02, cooldown: 180, slide: 0.88 },
  undo: { frequency: 430, duration: 72, type: "triangle", gain: 0.045, cooldown: 70, slide: 0.78 },
  redo: { frequency: 560, duration: 72, type: "sine", gain: 0.045, cooldown: 70, slide: 0.96 },
}

const STORAGE_KEY = "cyber-graph-sound-enabled"

export function useSound() {
  const [soundEnabled, setSoundEnabled] = useState(true)
  const audioContextRef = useRef<AudioContext | null>(null)
  const lastPlayedRef = useRef<Partial<Record<SoundType, number>>>({})
  const hydratedRef = useRef(false)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored !== null) setSoundEnabled(stored === "true")
    hydratedRef.current = true
  }, [])

  useEffect(() => {
    if (hydratedRef.current) localStorage.setItem(STORAGE_KEY, String(soundEnabled))
  }, [soundEnabled])

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) audioContextRef.current = new AudioContext()
    return audioContextRef.current
  }, [])

  const playSound = useCallback((type: SoundType) => {
    if (!soundEnabled) return
    const config = SOUND_CONFIG[type]
    const now = performance.now()
    if (config.cooldown && now - (lastPlayedRef.current[type] ?? -Infinity) < config.cooldown) return
    lastPlayedRef.current[type] = now

    try {
      const ctx = getAudioContext()
      if (ctx.state === "suspended") void ctx.resume()
    const start = ctx.currentTime
    const end = start + config.duration / 1000
    const variation = 1 + (Math.random() - 0.5) * 0.025
    const oscillator = ctx.createOscillator()

      const gainNode = ctx.createGain()
      oscillator.type = config.type
      oscillator.frequency.setValueAtTime(config.frequency * variation, start)
      oscillator.frequency.exponentialRampToValueAtTime(config.frequency * (config.slide ?? 0.82) * variation, end)
      gainNode.gain.setValueAtTime(0.001, start)
      gainNode.gain.exponentialRampToValueAtTime(config.gain, start + 0.008)
      gainNode.gain.exponentialRampToValueAtTime(0.001, end)
      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)
      oscillator.start(start)
      oscillator.stop(end)

      if (config.harmonic) {
        const overtone = ctx.createOscillator()
        const overtoneGain = ctx.createGain()
        overtone.type = "sine"
        overtone.frequency.setValueAtTime(config.frequency * config.harmonic * variation, start)
        overtoneGain.gain.setValueAtTime(config.gain * 0.22, start)
        overtoneGain.gain.exponentialRampToValueAtTime(0.001, end)
        overtone.connect(overtoneGain)
        overtoneGain.connect(ctx.destination)
        overtone.start(start)
        overtone.stop(end)
      }
    } catch {
      // Audio is optional and may be unavailable in the browser.
    }
  }, [soundEnabled, getAudioContext])

  const toggleSound = useCallback(() => setSoundEnabled((prev) => !prev), [])

  return { soundEnabled, toggleSound, playSound }
}
