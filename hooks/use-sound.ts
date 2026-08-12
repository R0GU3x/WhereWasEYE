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

type SoundConfig = {
  frequency: number
  duration: number
  type: OscillatorType
  gain: number
  harmonic?: number
  cooldown?: number
}

const SOUND_CONFIG: Record<SoundType, SoundConfig> = {
  nodeCreate: { frequency: 520, duration: 90, type: "sine", gain: 0.1, harmonic: 1.5 },
  nodeDelete: { frequency: 280, duration: 130, type: "sawtooth", gain: 0.06 },
  edgeConnect: { frequency: 660, duration: 70, type: "sine", gain: 0.08, harmonic: 2 },
  edgeDisconnect: { frequency: 330, duration: 110, type: "triangle", gain: 0.06 },
  statusChange: { frequency: 440, duration: 60, type: "sine", gain: 0.08 },
  click: { frequency: 800, duration: 35, type: "sine", gain: 0.045, cooldown: 45 },
  success: { frequency: 880, duration: 170, type: "sine", gain: 0.08, harmonic: 1.5 },
  error: { frequency: 200, duration: 210, type: "sawtooth", gain: 0.06 },
  snap: { frequency: 740, duration: 85, type: "triangle", gain: 0.075, harmonic: 2.02, cooldown: 180 },
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
      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()
      oscillator.type = config.type
      oscillator.frequency.setValueAtTime(config.frequency, start)
      oscillator.frequency.exponentialRampToValueAtTime(config.frequency * 0.82, end)
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
        overtone.frequency.setValueAtTime(config.frequency * config.harmonic, start)
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
