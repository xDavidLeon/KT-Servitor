import { useEffect, useRef } from 'react'

export function useKeyboardShortcuts({
  onFocusSearch,
  onClearSearch,
  onNavigateResults,
  onSelectResult,
  onShowHelp,
  enabled = true,
  selectedIndexRef
}) {
  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (e) => {
      // Don't trigger shortcuts when typing in inputs, textareas, or contenteditable
      const target = e.target
      const isInput = target.tagName === 'INPUT' || 
                      target.tagName === 'TEXTAREA' || 
                      target.isContentEditable

      // Special case: allow '/' to focus search even if in an input (but not if already in search)
      if (e.key === '/' && target.tagName === 'INPUT' && target.type === 'text') {
        // If already in search input, don't prevent default
        return
      }

      if (isInput && e.key !== '/') {
        return
      }

      // Handle shortcuts
      switch (e.key) {
        case '/':
          if (target.tagName !== 'INPUT') {
            e.preventDefault()
            onFocusSearch?.()
          }
          break

        case 'Escape':
          e.preventDefault()
          onClearSearch?.()
          if (selectedIndexRef) selectedIndexRef.current = -1
          break

        case 'ArrowDown':
          e.preventDefault()
          onNavigateResults?.('down')
          break

        case 'ArrowUp':
          e.preventDefault()
          onNavigateResults?.('up')
          break

        case 'j':
          if (!isInput) {
            e.preventDefault()
            onNavigateResults?.('down')
          }
          break

        case 'k':
          if (!isInput) {
            e.preventDefault()
            onNavigateResults?.('up')
          }
          break

        case 'Enter':
          if (selectedIndexRef && selectedIndexRef.current >= 0) {
            e.preventDefault()
            onSelectResult?.(selectedIndexRef.current)
            selectedIndexRef.current = -1
          }
          break

        case '?':
          if (!isInput && !e.shiftKey) {
            e.preventDefault()
            onShowHelp?.()
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [enabled, onFocusSearch, onClearSearch, onNavigateResults, onSelectResult, onShowHelp, selectedIndexRef])
}

