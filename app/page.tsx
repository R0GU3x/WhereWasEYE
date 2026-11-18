"use client"

import { GraphCanvas } from "@/components/graph/graph-canvas"
import { PwaControls } from "@/components/pwa-controls"

export default function Home() {
  return (
    <main className="h-dvh w-screen overflow-hidden bg-background">
      <GraphCanvas />
      <PwaControls />
    </main>
  )
}
