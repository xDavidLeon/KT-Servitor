import { useEffect, useState } from 'react'

function formatVersion(version) {
  if (!version) return null
  const [manifestPart, hashPart] = String(version).split('+')
  if (manifestPart && hashPart) {
    return `Data v${manifestPart} · ${hashPart.slice(0, 6)}`
  }
  return `Data v${manifestPart || version}`
}

export default function Footer() {
  const [versionLabel, setVersionLabel] = useState(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    let cancelled = false

    async function loadVersion() {
      try {
        const { getMeta } = await import('../lib/db')
        const stored = await getMeta('dataset_version')
        if (!cancelled) {
          setVersionLabel(formatVersion(stored))
        }
      } catch (err) {
        console.warn('Failed to read dataset version', err)
      }
    }

    const handleVersionUpdate = (event) => {
      if (cancelled) return
      const detail = event?.detail ?? null
      setVersionLabel(formatVersion(detail))
    }

    loadVersion()
    window.addEventListener('kt-version-updated', handleVersionUpdate)

    return () => {
      cancelled = true
      window.removeEventListener('kt-version-updated', handleVersionUpdate)
    }
  }, [])

  return (
    <footer className="app-footer">
      <div className="container app-footer-inner">
        <p className="app-footer-text">
          This free web-based app is a rules reference for Kill Team 2024 and features publicly available data; no copyrighted rule text. It is not affiliated with Games Workshop Ltd. This app is not a replacement for the official Kill Team 2024 rulebook. Kill team data courtesy of{' '}
          <a href="https://github.com/vjosset/killteamjson" target="_blank" rel="noreferrer">killteamjson</a>.
        </p>

        <div className="app-footer-meta">
          <span className="app-footer-credit">
            Crafted by{' '}
            <a
              href="https://xdavidleon.com"
              target="_blank"
              rel="noreferrer"
            >
              David León
            </a>
          </span>
          <a
            href="https://github.com/xDavidLeon/KT-Servitor"
            target="_blank"
            rel="noreferrer"
            className="app-footer-link"
            aria-label="View KT Servitor on GitHub"
          >
            <svg
              className="app-footer-icon"
              viewBox="0 0 16 16"
              aria-hidden="true"
              focusable="false"
            >
              <path
                fill="currentColor"
                d="M8 0C3.58 0 0 3.58 0 8a8 8 0 0 0 5.47 7.59c.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.01.08-2.11 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.91.08 2.11.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.19 0 .21.15.46.55.38A8 8 0 0 0 16 8c0-4.42-3.58-8-8-8Z"
              />
            </svg>
            <span>GitHub</span>
          </a>
        </div>

        {versionLabel && (
          <div style={{ marginTop: '1.5rem', textAlign: 'center', width: '100%', fontSize: '0.85rem', color: 'var(--muted)' }}>
            {versionLabel}
          </div>
        )}
      </div>
    </footer>
  )
}
