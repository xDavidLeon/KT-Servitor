
import { useMemo } from 'react';
import { marked } from 'marked';

marked.setOptions({
  gfm: true,
  breaks: true,
  smartypants: true,
});

export default function RichText({ text, className, as: Component = 'div', inline = false, highlightText, ...rest }) {
  const html = useMemo(() => {
    if (!text) return '';
    const value = typeof text === 'string' ? text : String(text);
    let parsed;
    if (inline || Component === 'span') {
      parsed = marked.parseInline(value);
    } else {
      parsed = marked.parse(value);
    }
    
    // If highlightText is provided, process the HTML to highlight the text
    if (highlightText && typeof highlightText === 'string' && highlightText.trim()) {
      // Quick check: if the text doesn't contain the keyword (case-insensitive), skip processing
      const normalizedHighlight = highlightText.trim().toUpperCase();
      const textUpper = parsed.toUpperCase();
      if (!textUpper.includes(normalizedHighlight)) {
        // No matches, skip expensive processing
      } else {
        // Escape special regex characters in highlightText
        const escaped = normalizedHighlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // For multi-word phrases, we need to match the whole phrase
        // Match word boundaries for single words, or the full phrase for multi-word
        const hasSpaces = escaped.includes('\\ ');
        const pattern = hasSpaces 
          ? `(${escaped})` // For multi-word, match the whole phrase (case-insensitive)
          : `\\b(${escaped})\\b`; // For single word, use word boundaries (case-insensitive)
        const regex = new RegExp(pattern, 'gi');
        
        // Replace matches, but avoid replacing inside HTML tags
        // We'll use a more sophisticated approach: split by HTML tags and process text nodes only
        const tagRegex = /(<[^>]+>)/g;
        const parts = parsed.split(tagRegex);
        
        parsed = parts.map((part) => {
          // Skip HTML tags
          if (part.startsWith('<') && part.endsWith('>')) {
            return part;
          }
          // Process text content - match case-insensitively but preserve original case
          return part.replace(regex, (match) => {
            return `<span class="faction-keyword-highlight">${match}<span class="faction-keyword-skull">💀</span></span>`;
          });
        }).join('');
      }
    }
    
    return parsed;
  }, [text, inline, Component, highlightText]);

  if (!text) return null;

  const combinedClassName = ['rich-text', className].filter(Boolean).join(' ');

  return (
    <Component
      className={combinedClassName}
      dangerouslySetInnerHTML={{ __html: html }}
      {...rest}
    />
  );
}
