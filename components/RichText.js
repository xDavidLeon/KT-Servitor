
import { useMemo } from 'react';
import { marked } from 'marked';

marked.setOptions({
  gfm: true,
  breaks: true,
  smartypants: true,
});

export default function RichText({ text, className, as: Component = 'div', inline = false }) {
  const html = useMemo(() => {
    if (!text) return '';
    const value = typeof text === 'string' ? text : String(text);
    if (inline || Component === 'span') {
      return marked.parseInline(value);
    }
    return marked.parse(value);
  }, [text, inline, Component]);

  if (!text) return null;

  return (
    <Component
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
