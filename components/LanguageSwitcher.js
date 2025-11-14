import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { useLocale } from '../lib/i18n'

const languages = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'es', name: 'Español', flag: '🇪🇸' }
]
const DEFAULT_LOCALE = 'en'

export default function LanguageSwitcher() {
  const router = useRouter()
  const currentLocale = useLocale()
  const [availableLocales, setAvailableLocales] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function resolveLocales() {
      try {
        const availability = await Promise.all(
          languages.map(async ({ code }) => {
            try {
              const res = await fetch(`/api/github-proxy?path=${encodeURIComponent(code)}`)
              if (!res.ok) {
                return code === DEFAULT_LOCALE
              }

              const payload = await res.json()
              if (!Array.isArray(payload)) {
                return code === DEFAULT_LOCALE
              }

              return payload.some(entry => entry?.type === 'dir')
            } catch (err) {
              console.warn(`Failed to inspect locale directory for ${code}`, err)
              return code === DEFAULT_LOCALE
            }
          })
        )

        if (cancelled) {
          return
        }

        const localesWithData = languages
          .filter((_, index) => availability[index])
          .map(lang => lang.code)

        setAvailableLocales(new Set(localesWithData))
      } catch (err) {
        console.warn('Failed to determine available locales', err)
        if (!cancelled) {
          setAvailableLocales(new Set([DEFAULT_LOCALE]))
        }
      }
    }

    resolveLocales()

    return () => {
      cancelled = true
    }
  }, [])

  const visibleLanguages = useMemo(() => {
    if (!availableLocales) {
      return languages
    }

    const filtered = languages.filter(
      (lang) => availableLocales.has(lang.code) || lang.code === currentLocale
    )

    if (filtered.length === 0) {
      return languages.filter((lang) => lang.code === (currentLocale || DEFAULT_LOCALE))
    }

    return filtered
  }, [availableLocales, currentLocale])

  const switchLanguage = (locale) => {
    router.push(router.asPath, router.asPath, { locale })
  }

  return (
    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
      {visibleLanguages.map((lang) => (
        <button
          key={lang.code}
          type="button"
          onClick={() => switchLanguage(lang.code)}
          className="pill"
          style={{
            cursor: 'pointer',
            borderColor: currentLocale === lang.code ? 'var(--accent)' : '#2a2f3f',
            color: currentLocale === lang.code ? 'var(--accent)' : 'var(--muted)',
            background: currentLocale === lang.code ? 'rgba(251, 146, 60, 0.1)' : 'transparent',
            padding: '0.35rem 0.75rem',
            fontSize: '0.85rem'
          }}
          aria-label={`Switch to ${lang.name}`}
        >
          <span style={{ marginRight: '0.35rem' }}>{lang.flag}</span>
          {lang.code.toUpperCase()}
        </button>
      ))}
    </div>
  )
}

