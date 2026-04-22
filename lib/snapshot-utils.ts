import html2canvas from "html2canvas"
import jsPDF from "jspdf"

export type SnapshotTheme = "light" | "dark"
export type ExportFormat = "png" | "svg" | "pdf"

interface SnapshotOptions {
  theme: SnapshotTheme
  format: ExportFormat
  transparent: boolean
  selectedNodesOnly: boolean
}

async function getCaptureElement(
  container: HTMLElement,
  selectedNodesOnly: boolean
): Promise<HTMLElement> {
  if (selectedNodesOnly) {
    const rf = container.querySelector('[data-testid="rf__wrapper"]') as HTMLElement
    if (!rf) {
      throw new Error("React Flow wrapper not found")
    }
    return rf
  }
  return container
}

async function applyTheme(
  element: HTMLElement,
  theme: SnapshotTheme
): Promise<HTMLElement> {
  const clone = element.cloneNode(true) as HTMLElement
  clone.style.position = "absolute"
  clone.style.left = "-9999px"
  clone.style.top = "-9999px"

  if (theme === "dark") {
    clone.classList.add("dark")
  } else {
    clone.classList.remove("dark")
  }

  document.body.appendChild(clone)
  return clone
}

export async function exportSnapshot(
  container: HTMLElement,
  options: SnapshotOptions
): Promise<void> {
  try {
    let captureElement = await getCaptureElement(container, options.selectedNodesOnly)

    if (options.theme === "light" || options.theme === "dark") {
      captureElement = await applyTheme(captureElement, options.theme)
    }

    const canvas = await html2canvas(captureElement, {
      backgroundColor: options.transparent ? null : options.theme === "dark" ? "#1a1a1a" : "#ffffff",
      scale: 2,
      useCORS: true,
      logging: false,
    })

    const fileName = `snapshot-${Date.now()}`

    if (options.format === "png") {
      const link = document.createElement("a")
      link.href = canvas.toDataURL("image/png")
      link.download = `${fileName}.png`
      link.click()
    } else if (options.format === "pdf") {
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? "landscape" : "portrait",
        unit: "px",
        format: [canvas.width, canvas.height],
      })

      const imgData = canvas.toDataURL("image/png")
      pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height)
      pdf.save(`${fileName}.pdf`)
    } else if (options.format === "svg") {
      // SVG export using canvas as base
      const link = document.createElement("a")
      link.href = canvas.toDataURL("image/png")
      link.download = `${fileName}.svg`
      link.click()
    }

    // Clean up
    if (options.theme === "light" || options.theme === "dark") {
      const clone = document.querySelector('[style*="left: -9999px"]')
      if (clone) clone.remove()
    }
  } catch (error) {
    console.error("[v0] Snapshot export failed:", error)
    throw error
  }
}
