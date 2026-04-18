"use client"

import { GraphCanvas } from "@/components/graph/graph-canvas"

export default function Home() {
  return (
    <main className="h-screen w-screen overflow-hidden bg-background">
      <GraphCanvas />
    </main>
  )
}
