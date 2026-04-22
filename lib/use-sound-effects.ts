import { useState, useEffect } from "react"
import { areSoundEffectsEnabled, toggleSoundEffects, playSoundIfEnabled, type SoundEffect } from "@/lib/sound-utils"

export function useSoundEffects() {
  const [enabled, setEnabled] = useState(true)

  useEffect(() => {
    setEnabled(areSoundEffectsEnabled())
  }, [])

  const toggle = () => {
    const newState = !enabled
    setEnabled(newState)
    toggleSoundEffects(newState)
  }

  const play = (effect: SoundEffect) => {
    playSoundIfEnabled(effect)
  }

  return { enabled, toggle, play }
}
