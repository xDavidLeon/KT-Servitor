import { useEffect, useState } from 'react'
import { forceUpdateAndReindex, checkForUpdates } from '../lib/update'

function download(filename, text) {
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

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
  const [status, setStatus] = useState('Checking for data updates…')
  const [menuOpen, setMenuOpen] = useState(false)

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

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    let cancelled = false

    async function runUpdateCheck() {
      setStatus('Checking for data updates…')
      try {
        const upd = await checkForUpdates()
        if (cancelled) return

        if (upd.error) {
          setStatus('Offline (using cached data)')
        } else if (upd.warning) {
          setStatus('Partial data update')
        } else {
          setStatus(upd.updated ? 'Data updated' : 'Up to date')
        }

        if (upd.version) {
          setVersionLabel(formatVersion(upd.version))
          try {
            window.dispatchEvent(new CustomEvent('kt-version-updated', { detail: upd.version }))
          } catch (err) {
            console.warn('Failed to dispatch version update event', err)
          }
        }
      } catch (err) {
        if (!cancelled) {
          setStatus('Offline (using cached data)')
        }
      }
    }

    runUpdateCheck()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (typeof document === 'undefined') return undefined
    const handleDocumentClick = (event) => {
      if (!event.target.closest?.('#footer-gear')) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('click', handleDocumentClick)
    return () => document.removeEventListener('click', handleDocumentClick)
  }, [])

  async function handleReset() {
    if (typeof window === 'undefined') return
    if (!confirm('Reset local data and reload?')) return
    setMenuOpen(false)
    try {
      const { db } = await import('../lib/db')
      db.close()
    } catch {}
    if (window.caches) {
      try {
        const keys = await caches.keys()
        await Promise.all(keys.map((k) => caches.delete(k)))
      } catch (err) {
        console.warn('Failed clearing caches', err)
      }
    }
    try {
      await indexedDB.deleteDatabase('ktdemo')
    } catch {}
    try {
      localStorage.clear()
      sessionStorage.clear()
    } catch {}
    window.location.reload()
  }

  async function handleForceUpdate() {
    setMenuOpen(false)
    setStatus('Updating data…')
    const res = await forceUpdateAndReindex()
    if (!res.ok) {
      setStatus('Update failed')
      alert(`Update failed: ${res.error}`)
      return
    }

    if (res.version) {
      setVersionLabel(formatVersion(res.version))
      try {
        window.dispatchEvent(new CustomEvent('kt-version-updated', { detail: res.version }))
      } catch (err) {
        console.warn('Failed to dispatch version update event', err)
      }
      setStatus('Data updated')
    } else {
      setStatus('Data updated')
    }

    alert(`Updated to data v${res.version}.`)
  }

  async function handleExport() {
    const { db } = await import('../lib/db')
    const [articles, killteams] = await Promise.all([
      db.articles.toArray(),
      db.killteams.toArray()
    ])
    const payload = {
      generatedAt: new Date().toISOString(),
      articles,
      killteams
    }
    download(
      `ktdata-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(payload, null, 2)
    )
    setMenuOpen(false)
  }

  function handleAbout() {
    alert(
      'KT Servitor is a personal project by @xdavidleon.\n\nThis free web-based app is a community-driven open source rules reference for Kill Team 2024. It is not affiliated with Games Workshop Ltd. This app is not a replacement for the official Kill Team 2024 rulebook.'
    )
    setMenuOpen(false)
  }

  return (
    <footer className="app-footer">
      <div className="container app-footer-inner">
        <p className="app-footer-text">
          This free web-based app is a community-driven open source rules reference for Kill Team 2024. It is not affiliated with Games Workshop Ltd. This app is not a replacement for the official Kill Team 2024 rulebook. Kill team data courtesy of{' '}
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

          <div
            style={{
              marginTop: versionLabel ? '0.75rem' : '1.5rem',
              width: '100%',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '0.6rem',
              flexWrap: 'wrap',
              fontSize: '0.85rem',
              color: 'var(--muted)'
            }}
          >
            {status && <span>{status}</span>}
            <div id="footer-gear" style={{ position: 'relative', display: 'inline-flex' }}>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                title="Menu"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'none',
                  border: '1px solid #333',
                  borderRadius: '50%',
                  width: '1.9rem',
                  height: '1.9rem',
                  color: 'var(--muted)',
                  fontSize: '1.1rem',
                  lineHeight: 1,
                  cursor: 'pointer',
                  transition: '0.2s'
                }}
                onMouseOver={(e) => (e.currentTarget.style.color = 'var(--accent)')}
                onMouseOut={(e) => (e.currentTarget.style.color = 'var(--muted)')}
              >
                ⚙️
              </button>
              {menuOpen && (
                <div
                  className="menu"
                  id="footer-gear"
                  style={{
                    top: 'auto',
                    bottom: 'calc(100% + 0.75rem)',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    right: 'auto'
                  }}
                >
                  <button onClick={handleForceUpdate}>Force update</button>
                  <div className="sep"></div>
                  <button onClick={handleExport}>Export data (JSON)</button>
                  <div className="sep"></div>
                  <button onClick={handleReset}>Reset data</button>
                  <div className="sep"></div>
                  <button onClick={handleAbout}>About</button>
                </div>
              )}
            </div>
          </div>
      </div>
    </footer>
  )
}
