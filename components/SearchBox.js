import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react'

const SearchBox = forwardRef(function SearchBox({ q, setQ }, ref) {
  const inputRef = useRef(null)

  useImperativeHandle(ref, () => ({
    focus: () => {
      inputRef.current?.focus()
    },
    blur: () => {
      inputRef.current?.blur()
    }
  }))

  return (
    <div className="card">
      <input
        ref={inputRef}
        placeholder="Search rules, units, keywords… (Press / to focus)"
        value={q}
        onChange={e => setQ(e.target.value)}
        onKeyDown={(e) => {
          // Prevent '/' from being typed when focusing via shortcut
          if (e.key === '/' && document.activeElement !== inputRef.current) {
            e.preventDefault()
          }
        }}
        style={{ width: '100%' }}
      />
    </div>
  )
})

export default SearchBox
