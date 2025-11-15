import { useCallback, useState, useEffect } from 'react'

/**
 * Custom hook for haptic feedback on mobile devices
 * Uses the Vibration API when available
 * @returns {Object} - Haptic feedback functions
 */
export function useHapticFeedback() {
  const [isSupported, setIsSupported] = useState(false)

  // Only check for support on client to avoid hydration issues
  useEffect(() => {
    setIsSupported(typeof window !== 'undefined' && 'vibrate' in navigator)
  }, [])

  const vibrate = useCallback((pattern) => {
    if (!isSupported) return false
    
    try {
      // Pattern can be a number (duration in ms) or array of durations
      navigator.vibrate(pattern)
      return true
    } catch (err) {
      // Silently fail if vibration is not supported or blocked
      return false
    }
  }, [isSupported])

  // Light tap feedback (short vibration)
  const lightTap = useCallback(() => {
    return vibrate(10)
  }, [vibrate])

  // Medium tap feedback
  const mediumTap = useCallback(() => {
    return vibrate(20)
  }, [vibrate])

  // Success feedback (double pulse)
  const success = useCallback(() => {
    return vibrate([10, 50, 10])
  }, [vibrate])

  // Error feedback (triple pulse)
  const error = useCallback(() => {
    return vibrate([20, 50, 20, 50, 20])
  }, [vibrate])

  // Navigation feedback (single medium pulse)
  const navigation = useCallback(() => {
    return vibrate(15)
  }, [vibrate])

  // Selection feedback (very light tap)
  const selection = useCallback(() => {
    return vibrate(5)
  }, [vibrate])

  return {
    isSupported,
    vibrate,
    lightTap,
    mediumTap,
    success,
    error,
    navigation,
    selection
  }
}

