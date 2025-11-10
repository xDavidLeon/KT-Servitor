const MARKDOWN_LINK_PATTERN = /\[([^\]]+)\]\([^)]+\)/g
const MARKDOWN_IMAGE_PATTERN = /!\[[^\]]*\]\([^)]+\)/g
const HTML_TAG_PATTERN = /<[^>]+>/g
const INLINE_MARKDOWN_PATTERN = /[*_`~>/#=-]+/g
const MULTISPACE_PATTERN = /\s+/g

export function toPlainText(value) {
  if (value === null || value === undefined) {
    return ''
  }

  const stringValue = Array.isArray(value) ? value.join(' ') : String(value)

  return stringValue
    .replace(/\r\n/g, '\n')
    .replace(MARKDOWN_IMAGE_PATTERN, ' ')
    .replace(MARKDOWN_LINK_PATTERN, '$1')
    .replace(HTML_TAG_PATTERN, ' ')
    .replace(INLINE_MARKDOWN_PATTERN, ' ')
    .replace(MULTISPACE_PATTERN, ' ')
    .trim()
}

export function truncateText(value, length = 155) {
  const plain = toPlainText(value)
  if (!plain) return ''
  if (plain.length <= length) return plain

  const truncated = plain.slice(0, length).replace(/\s+\S*$/, '')
  return `${truncated.trim()}…`
}
