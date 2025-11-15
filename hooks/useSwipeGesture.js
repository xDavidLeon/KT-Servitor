import { useRef, useEffect } from 'react'

/**
 * Custom hook for detecting swipe gestures on touch devices
 * @param {Object} options - Configuration options
 * @param {Function} options.onSwipeLeft - Callback when swiping left
 * @param {Function} options.onSwipeRight - Callback when swiping right
 * @param {number} options.minSwipeDistance - Minimum distance in pixels to trigger swipe (default: 50)
 * @param {number} options.maxVerticalSwipe - Maximum vertical movement to consider it horizontal swipe (default: 100)
 * @param {boolean} options.enabled - Whether swipe detection is enabled (default: true)
 * @returns {Object} - Ref to attach to the element
 */
export function useSwipeGesture({
  onSwipeLeft,
  onSwipeRight,
  minSwipeDistance = 50,
  maxVerticalSwipe = 100,
  enabled = true
}) {
  const touchStartRef = useRef(null)
  const touchEndRef = useRef(null)
  const elementRef = useRef(null)

  useEffect(() => {
    if (!enabled) return

    const element = elementRef.current
    if (!element) return

    const handleTouchStart = (e) => {
      const touch = e.touches[0]
      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now()
      }
      touchEndRef.current = null
    }

    const handleTouchMove = (e) => {
      const touch = e.touches[0]
      touchEndRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now()
      }
    }

    const handleTouchEnd = () => {
      if (!touchStartRef.current || !touchEndRef.current) return

      const start = touchStartRef.current
      const end = touchEndRef.current

      const deltaX = end.x - start.x
      const deltaY = end.y - start.y
      const deltaTime = end.time - start.time

      // Calculate distances
      const horizontalDistance = Math.abs(deltaX)
      const verticalDistance = Math.abs(deltaY)

      // Only trigger if horizontal swipe is dominant
      if (verticalDistance > maxVerticalSwipe) {
        touchStartRef.current = null
        touchEndRef.current = null
        return
      }

      // Check if swipe distance is sufficient
      if (horizontalDistance < minSwipeDistance) {
        touchStartRef.current = null
        touchEndRef.current = null
        return
      }

      // Calculate velocity (pixels per ms)
      const velocity = horizontalDistance / deltaTime

      // Require minimum velocity to distinguish from slow drags (0.1 px/ms)
      if (velocity < 0.1) {
        touchStartRef.current = null
        touchEndRef.current = null
        return
      }

      // Determine swipe direction
      if (deltaX > 0) {
        // Swipe right
        onSwipeRight?.()
      } else {
        // Swipe left
        onSwipeLeft?.()
      }

      touchStartRef.current = null
      touchEndRef.current = null
    }

    element.addEventListener('touchstart', handleTouchStart, { passive: true })
    element.addEventListener('touchmove', handleTouchMove, { passive: true })
    element.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      element.removeEventListener('touchstart', handleTouchStart)
      element.removeEventListener('touchmove', handleTouchMove)
      element.removeEventListener('touchend', handleTouchEnd)
    }
  }, [enabled, onSwipeLeft, onSwipeRight, minSwipeDistance, maxVerticalSwipe])

  return elementRef
}

