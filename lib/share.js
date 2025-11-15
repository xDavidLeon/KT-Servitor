// lib/share.js
// Share functionality utilities

/**
 * Check if Web Share API is available
 */
export function isWebShareAvailable() {
  return typeof navigator !== 'undefined' && 'share' in navigator
}

/**
 * Check if clipboard API is available
 */
export function isClipboardAvailable() {
  return typeof navigator !== 'undefined' && 'clipboard' in navigator && 'writeText' in navigator.clipboard
}

/**
 * Get the current page URL
 */
export function getCurrentUrl() {
  if (typeof window === 'undefined') return ''
  return window.location.href
}

/**
 * Build a shareable URL for a specific item
 */
export function buildShareUrl(path, anchor = null) {
  if (typeof window === 'undefined') return ''
  
  const baseUrl = window.location.origin
  const url = anchor ? `${baseUrl}${path}#${anchor}` : `${baseUrl}${path}`
  return url
}

/**
 * Share using Web Share API (native mobile)
 */
export async function shareNative(data) {
  if (!isWebShareAvailable()) {
    return { success: false, error: 'Web Share API not available' }
  }

  try {
    await navigator.share(data)
    return { success: true }
  } catch (error) {
    // User cancelled or error occurred
    if (error.name === 'AbortError') {
      return { success: false, cancelled: true }
    }
    return { success: false, error: error.message }
  }
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text) {
  if (!isClipboardAvailable()) {
    // Fallback for older browsers
    return fallbackCopyToClipboard(text)
  }

  try {
    await navigator.clipboard.writeText(text)
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

/**
 * Fallback copy to clipboard for older browsers
 */
function fallbackCopyToClipboard(text) {
  try {
    const textArea = document.createElement('textarea')
    textArea.value = text
    textArea.style.position = 'fixed'
    textArea.style.left = '-999999px'
    textArea.style.top = '-999999px'
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()
    
    const successful = document.execCommand('copy')
    document.body.removeChild(textArea)
    
    return { success: successful }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

/**
 * Share a page/item with title and URL
 */
export async function sharePage({ title, text, url }) {
  const shareUrl = url || getCurrentUrl()
  const shareText = text || title || 'Check this out!'
  
  // Try native share first (mobile)
  if (isWebShareAvailable()) {
    const result = await shareNative({
      title: title || 'KT Servitor',
      text: shareText,
      url: shareUrl
    })
    
    if (result.success || result.cancelled) {
      return result
    }
  }
  
  // Fallback to clipboard
  const copyResult = await copyToClipboard(shareUrl)
  if (copyResult.success) {
    return { success: true, method: 'clipboard', url: shareUrl }
  }
  
  return { success: false, error: 'Failed to share' }
}

