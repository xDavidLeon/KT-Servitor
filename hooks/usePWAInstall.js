import { useState, useEffect } from 'react'

/**
 * Custom hook to detect PWA installability and handle installation
 * @returns {Object} - { isInstallable, isInstalled, prompt, install }
 */
export function usePWAInstall() {
  const [isInstallable, setIsInstallable] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState(null)

  useEffect(() => {
    // Check if app is already installed
    if (typeof window === 'undefined') return

    // Check if running in standalone mode (already installed)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                        window.navigator.standalone === true ||
                        document.referrer.includes('android-app://')

    setIsInstalled(isStandalone)

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e) => {
      // Prevent the default browser install prompt
      e.preventDefault()
      // Store the event for later use
      setDeferredPrompt(e)
      setIsInstallable(true)
    }

    // Listen for app installed event
    const handleAppInstalled = () => {
      setIsInstalled(true)
      setIsInstallable(false)
      setDeferredPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const install = async () => {
    if (!deferredPrompt) {
      return false
    }

    try {
      // Show the install prompt
      deferredPrompt.prompt()

      // Wait for the user to respond
      const { outcome } = await deferredPrompt.userChoice

      // Clear the deferred prompt
      setDeferredPrompt(null)
      setIsInstallable(false)

      if (outcome === 'accepted') {
        return true
      }
      return false
    } catch (err) {
      console.warn('Error showing install prompt', err)
      return false
    }
  }

  return {
    isInstallable,
    isInstalled,
    prompt: deferredPrompt,
    install
  }
}

