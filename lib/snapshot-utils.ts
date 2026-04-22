import html2canvas from "html2canvas"

export type SnapshotTheme = "light" | "dark"
export type ExportFormat = "png" | "svg"

interface SnapshotOptions {
  theme: SnapshotTheme
  format: ExportFormat
  transparent: boolean
  selectedNodesOnly: boolean
}

async function applyTheme(
  element: HTMLElement,
  theme: SnapshotTheme
): Promise<() => void> {
  const originalClass = element.className
  
  // Remove existing theme class
  element.className = element.className.replace(/\bdark\b/, "").trim()
  
  // Add new theme class
  if (theme === "dark") {
    element.classList.add("dark")
  }
  
  // Return cleanup function
  return () => {
    element.className = originalClass
  }
}

export async function exportSnapshot(
  container: HTMLElement,
  options: SnapshotOptions
): Promise<void> {
  try {
    const cleanup = await applyTheme(container, options.theme)

    const canvas = await html2canvas(container, {
      backgroundColor: options.transparent ? null : options.theme === "dark" ? "#1a1a1a" : "#ffffff",
      scale: 2,
      useCORS: true,
      logging: false,
      allowTaint: true,
    })

    const fileName = `snapshot-${Date.now()}`

    if (options.format === "png") {
      const link = document.createElement("a")
      link.href = canvas.toDataURL("image/png")
      link.download = `${fileName}.png`
      link.click()
    } else if (options.format === "svg") {
      // SVG export: create SVG wrapper with embedded PNG
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
      svg.setAttribute("width", String(canvas.width))
      svg.setAttribute("height", String(canvas.height))
      svg.setAttribute("viewBox", `0 0 ${canvas.width} ${canvas.height}`)
      svg.setAttribute("xmlns", "http://www.w3.org/2000/svg")
      
      // Add background if not transparent
      if (!options.transparent) {
        const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect")
        bg.setAttribute("width", String(canvas.width))
        bg.setAttribute("height", String(canvas.height))
        bg.setAttribute("fill", options.theme === "dark" ? "#1a1a1a" : "#ffffff")
        svg.appendChild(bg)
      }

      // Embed canvas as image
      const image = document.createElementNS("http://www.w3.org/2000/svg", "image")
      image.setAttributeNS("http://www.w3.org/1999/xlink", "href", canvas.toDataURL("image/png"))
      image.setAttribute("width", String(canvas.width))
      image.setAttribute("height", String(canvas.height))
      svg.appendChild(image)

      // Download SVG
      const svgString = new XMLSerializer().serializeToString(svg)
      const blob = new Blob([svgString], { type: "image/svg+xml" })
      const url = URL.createObjectURL(blob)
      
      const link = document.createElement("a")
      link.href = url
      link.download = `${fileName}.svg`
      link.click()
      
      URL.revokeObjectURL(url)
    }

    cleanup()
  } catch (error) {
    console.error("[v0] Snapshot export failed:", error)
    throw error
  }
}
