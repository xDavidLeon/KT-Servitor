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
        'KT Servitor is a community-driven open source rules reference for Kill Team 2024.\n\nThis free web-based app is not affiliated with Games Workshop Ltd. This app is not a replacement for the official Kill Team 2024 rulebook.\n\nContact: ktservitor@proton.me.'
      )
    setMenuOpen(false)
  }

  return (
    <footer className="app-footer">
      <div className="container app-footer-inner">
        <p className="app-footer-text">
          This site is a free community project not associated with Games Workshop in any way.
        </p>
        <p className="app-footer-text">
          GW, Games Workshop, Citadel, White Dwarf, Warhammer, Warhammer Kill Team, and all associated logos, illustrations, images, names, creatures, races, locations, weapons, characters, and the distinctive likenesses thereof, are either ® or ™, and/or © Games Workshop Limited, variably registered around the world. All Rights Reserved. Used without permission. No challenge to their status intended.
        </p>

          <div className="app-footer-meta">
            <a
              href="mailto:ktservitor@proton.me"
              className="app-footer-link"
              aria-label="Email KT Servitor"
            >
              <svg
                className="app-footer-icon"
                viewBox="0 0 16 16"
                aria-hidden="true"
                focusable="false"
              >
                <path
                  fill="currentColor"
                  d="M1.5 2.5h13a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 0 12V4a1.5 1.5 0 0 1 1.5-1.5Zm0 1a.5.5 0 0 0-.5.5v.217l7 4.2 7-4.2V4a.5.5 0 0 0-.5-.5h-13Zm13 9a.5.5 0 0 0 .5-.5V6.383l-7.03 4.218a.5.5 0 0 1-.48 0L.5 6.383V12a.5.5 0 0 0 .5.5h13Z"
                />
              </svg>
              <span>Email</span>
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
