/**
 * Sound effects using Web Audio API
 * No external dependencies needed
 */

export type SoundEffect = "nodeCreate" | "edgeAttach" | "edgeDetach" | "statusChange" | "nodeDelete"

interface SoundConfig {
  frequency: number
  duration: number
  volume: number
  waveType: OscillatorType
}

const soundConfigs: Record<SoundEffect, SoundConfig> = {
  nodeCreate: {
    frequency: 523.25, // C5
    duration: 0.1,
    volume: 0.3,
    waveType: "sine",
  },
  edgeAttach: {
    frequency: 659.25, // E5
    duration: 0.08,
    volume: 0.25,
    waveType: "sine",
  },
  edgeDetach: {
    frequency: 392, // G4
    duration: 0.08,
    volume: 0.25,
    waveType: "sine",
  },
  statusChange: {
    frequency: 587.33, // D5
    duration: 0.12,
    volume: 0.28,
    waveType: "sine",
  },
  nodeDelete: {
    frequency: 261.63, // C4
    duration: 0.15,
    volume: 0.3,
    waveType: "sine",
  },
}

let audioContext: AudioContext | null = null

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
  }
  return audioContext
}

export function playSound(effect: SoundEffect): void {
  const config = soundConfigs[effect]
  const context = getAudioContext()

  // Create oscillator
  const oscillator = context.createOscillator()
  oscillator.frequency.value = config.frequency
  oscillator.type = config.waveType

  // Create gain node for volume
  const gainNode = context.createGain()
  gainNode.gain.setValueAtTime(config.volume, context.currentTime)
  gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + config.duration)

  // Connect nodes
  oscillator.connect(gainNode)
  gainNode.connect(context.destination)

  // Play sound
  oscillator.start(context.currentTime)
  oscillator.stop(context.currentTime + config.duration)
}

export function toggleSoundEffects(enabled: boolean): void {
  localStorage.setItem("sound-effects-enabled", JSON.stringify(enabled))
}

export function areSoundEffectsEnabled(): boolean {
  const stored = localStorage.getItem("sound-effects-enabled")
  return stored !== null ? JSON.parse(stored) : true
}

export function playSoundIfEnabled(effect: SoundEffect): void {
  if (areSoundEffectsEnabled()) {
    playSound(effect)
  }
}
