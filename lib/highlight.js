/**
 * Highlights matching search terms in text
 * @param {string} text - The text to highlight
 * @param {string} query - The search query
 * @returns {Array|string} - Array of React elements or plain string if no matches
 */
export function highlightText(text, query) {
  if (!text || typeof text !== 'string') return text
  if (!query || typeof query !== 'string' || !query.trim()) return text

  const trimmedQuery = query.trim()
  if (!trimmedQuery) return text

  // Escape special regex characters in the query
  const escapedQuery = trimmedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  
  // Create regex for case-insensitive matching
  const regex = new RegExp(`(${escapedQuery})`, 'gi')
  
  // Split text by matches and create array of parts
  const parts = text.split(regex)
  
  // If no matches, return original text
  if (parts.length === 1) return text
  
  // Map parts to React elements or strings
  return parts.map((part, index) => {
    // Check if this part matches the query (case-insensitive)
    if (part.toLowerCase() === trimmedQuery.toLowerCase()) {
      return (
        <mark key={index} style={{
          backgroundColor: 'rgba(251, 146, 60, 0.3)',
          color: '#fb923c',
          padding: '0.1em 0.2em',
          borderRadius: '2px',
          fontWeight: 500
        }}>
          {part}
        </mark>
      )
    }
    return part
  })
}

/**
 * Highlights matching search terms in text (returns plain HTML string)
 * Useful for non-React contexts
 * @param {string} text - The text to highlight
 * @param {string} query - The search query
 * @returns {string} - HTML string with highlighted terms
 */
export function highlightTextHTML(text, query) {
  if (!text || typeof text !== 'string') return text
  if (!query || typeof query !== 'string' || !query.trim()) return text

  const trimmedQuery = query.trim()
  if (!trimmedQuery) return text

  // Escape special regex characters in the query
  const escapedQuery = trimmedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  
  // Create regex for case-insensitive matching
  const regex = new RegExp(`(${escapedQuery})`, 'gi')
  
  // Replace matches with highlighted version
  return text.replace(regex, (match) => {
    return `<mark style="background-color: rgba(251, 146, 60, 0.3); color: #fb923c; padding: 0.1em 0.2em; border-radius: 2px; font-weight: 500;">${match}</mark>`
  })
}

