"use client"

import { useEffect, useState } from "react"
import { Download, RefreshCw, Smartphone, X } from "lucide-react"

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>
}

export function PwaControls() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [isAppleBrowser, setIsAppleBrowser] = useState(false)
  const [isChromiumBrowser, setIsChromiumBrowser] = useState(false)
  const [isIos, setIsIos] = useState(false)
  const [showInstallHelp, setShowInstallHelp] = useState(false)
  const [updateWaiting, setUpdateWaiting] = useState(false)
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)

  useEffect(() => {
    const standaloneQuery = window.matchMedia("(display-mode: standalone)")
    const syncInstalledState = () => {
      setIsInstalled(standaloneQuery.matches || ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone)))
    }
    const onInstallPrompt = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as InstallPromptEvent)
    }
    const onInstalled = () => {
      setIsInstalled(true)
      setInstallPrompt(null)
      setShowInstallHelp(false)
    }

    syncInstalledState()
    const installBrowserCheck = window.setTimeout(() => {
      const userAgent = navigator.userAgent
      setIsIos(/iPad|iPhone|iPod/.test(userAgent))
      setIsAppleBrowser(/iPad|iPhone|iPod/.test(userAgent) || (/Safari/.test(userAgent) && !/Chrome|Chromium|CriOS|Edg/.test(userAgent)))
      setIsChromiumBrowser(/Chrome|Chromium|Edg/.test(userAgent))
    }, 0)
    standaloneQuery.addEventListener("change", syncInstalledState)
    window.addEventListener("beforeinstallprompt", onInstallPrompt)
    window.addEventListener("appinstalled", onInstalled)

    let disposed = false
    const onControllerChange = () => {
      if (!isUpdating) return
      window.location.reload()
    }

    if ("serviceWorker" in navigator && window.isSecureContext && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.addEventListener("controllerchange", onControllerChange)
      const workerUrl = `/sw.js?v=${encodeURIComponent(process.env.NEXT_PUBLIC_PWA_BUILD_ID ?? "local")}`
      navigator.serviceWorker.register(workerUrl, { scope: "/" }).then((nextRegistration) => {
        if (disposed) return
        setRegistration(nextRegistration)
        setUpdateWaiting(Boolean(nextRegistration.waiting))
        nextRegistration.addEventListener("updatefound", () => {
          const installingWorker = nextRegistration.installing
          if (!installingWorker) return
          installingWorker.addEventListener("statechange", () => {
            if (installingWorker.state === "installed" && navigator.serviceWorker.controller) setUpdateWaiting(true)
          })
        })
        void nextRegistration.update().catch(() => undefined)
      }).catch(() => undefined)
    }

    return () => {
      disposed = true
      window.clearTimeout(installBrowserCheck)
      standaloneQuery.removeEventListener("change", syncInstalledState)
      window.removeEventListener("beforeinstallprompt", onInstallPrompt)
      window.removeEventListener("appinstalled", onInstalled)
      navigator.serviceWorker?.removeEventListener("controllerchange", onControllerChange)
    }
  }, [isUpdating])

  const installApp = async () => {
    if (!installPrompt) {
      setShowInstallHelp(true)
      return
    }
    await installPrompt.prompt()
    const choice = await installPrompt.userChoice
    if (choice.outcome === "accepted") setIsInstalled(true)
    setInstallPrompt(null)
  }

  const applyUpdate = () => {
    if (!registration?.waiting) return
    const shouldUpdate = window.confirm("Your workspace is saved automatically. Finish any text edit in progress before updating. Apply the update now?")
    if (!shouldUpdate) return
    setIsUpdating(true)
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    window.setTimeout(() => registration.waiting?.postMessage({ type: "SKIP_WAITING" }), 250)
  }

  if (isInstalled && !updateWaiting) return null

  return (
    <div className="fixed bottom-[4.5rem] left-4 z-[80] flex max-w-[calc(100vw-2rem)] flex-col items-start gap-2">
      {updateWaiting && (
        <div role="status" className="flex max-w-sm items-center gap-3 rounded-lg border border-primary/40 bg-card px-3 py-2 text-xs text-card-foreground shadow-lg">
          <span className="text-muted-foreground">An update is ready. Your workspace stays on this version until you apply it.</span>
          <button type="button" onClick={applyUpdate} disabled={isUpdating} className="inline-flex shrink-0 items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 font-medium text-primary-foreground disabled:opacity-60">
            <RefreshCw aria-hidden="true" className="size-3.5" />
            {isUpdating ? "Updating…" : "Update"}
          </button>
        </div>
      )}
      {!isInstalled && (installPrompt || isAppleBrowser || isChromiumBrowser) && (
        <button type="button" onClick={installApp} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border bg-card/95 px-3.5 text-sm font-medium text-card-foreground shadow-lg backdrop-blur transition-colors hover:border-primary/50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {installPrompt ? <Download aria-hidden="true" className="size-4" /> : <Smartphone aria-hidden="true" className="size-4" />}
          Install App
        </button>
      )}
      {showInstallHelp && (
        <div role="dialog" aria-labelledby="install-help-title" className="w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-border bg-card p-4 text-card-foreground shadow-xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="install-help-title" className="text-sm font-semibold">Install WhereWasEYE</h2>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {isIos
                  ? "In Safari, tap Share, then Add to Home Screen."
                  : isAppleBrowser
                    ? "In Safari on macOS, choose File → Add to Dock."
                    : "Open your browser menu and choose Install app or Add to Home screen."}
              </p>
            </div>
            <button type="button" aria-label="Close install instructions" onClick={() => setShowInstallHelp(false)} className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <X aria-hidden="true" className="size-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
