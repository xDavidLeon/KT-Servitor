// hooks/useServiceWorkerUpdate.js
// Hook to detect and manage service worker updates

import { useState, useEffect, useCallback, useRef } from 'react'

export function useServiceWorkerUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const registrationRef = useRef(null)
  const waitingWorkerRef = useRef(null)

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return
    }

    let registration = null

    const checkForUpdates = async () => {
      try {
        registration = await navigator.serviceWorker.getRegistration()
        if (!registration) return

        registrationRef.current = registration

        // Check if there's already a waiting service worker
        if (registration.waiting) {
          waitingWorkerRef.current = registration.waiting
          setUpdateAvailable(true)
        }

        // Listen for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing
          if (!newWorker) return

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed') {
              // If there's no active service worker, this is the first install
              if (registration.active) {
                // There's an update available
                waitingWorkerRef.current = newWorker
                setUpdateAvailable(true)
              }
            }
          })
        })

        // Listen for controller change (when a new service worker takes control)
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          // Reload the page to use the new service worker
          window.location.reload()
        })
      } catch (error) {
        console.warn('Service worker update check failed:', error)
      }
    }

    // Check immediately
    checkForUpdates()

    // Also check periodically (every 5 minutes)
    const interval = setInterval(checkForUpdates, 5 * 60 * 1000)

    return () => {
      clearInterval(interval)
    }
  }, [])

  const skipWaiting = useCallback(async () => {
    if (!waitingWorkerRef.current || !registrationRef.current) return

    setIsUpdating(true)

    try {
      // Call skipWaiting on the waiting service worker
      // This will make it activate immediately
      if (waitingWorkerRef.current.state === 'installed') {
        waitingWorkerRef.current.postMessage({ type: 'SKIP_WAITING' })
      }

      // Listen for the controllerchange event which fires when the new SW takes control
      const controllerChangeHandler = () => {
        window.location.reload()
      }
      navigator.serviceWorker.addEventListener('controllerchange', controllerChangeHandler)

      // Fallback: if controllerchange doesn't fire, reload after a short delay
      setTimeout(() => {
        if (navigator.serviceWorker.controller !== waitingWorkerRef.current) {
          window.location.reload()
        }
      }, 1000)
    } catch (error) {
      console.error('Failed to skip waiting:', error)
      setIsUpdating(false)
    }
  }, [])

  const dismissUpdate = useCallback(() => {
    setUpdateAvailable(false)
    waitingWorkerRef.current = null
  }, [])

  return {
    updateAvailable,
    isUpdating,
    skipWaiting,
    dismissUpdate
  }
}

