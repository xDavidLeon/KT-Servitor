import { useEffect, useMemo, useState, useRef } from 'react'
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
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)

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
      const fallbackLocale = currentLocale || DEFAULT_LOCALE
      const fallbackLang = languages.find(lang => lang.code === fallbackLocale)
      return fallbackLang ? [fallbackLang] : []
    }

    const filtered = languages.filter((lang) => {
      if (availableLocales.has(lang.code)) {
        return true
      }
      return lang.code === currentLocale
    })

    if (filtered.length === 0) {
      return languages.filter((lang) => lang.code === (currentLocale || DEFAULT_LOCALE))
    }

    return filtered
  }, [availableLocales, currentLocale])

  const currentLanguage = useMemo(() => {
    return languages.find(lang => lang.code === currentLocale) || languages.find(lang => lang.code === DEFAULT_LOCALE)
  }, [currentLocale])

  const switchLanguage = (locale) => {
    router.push(router.asPath, router.asPath, { locale })
    setIsOpen(false)
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  return (
    <div className="language-switcher" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="language-switcher-button"
        aria-label="Select language"
        aria-expanded={isOpen}
      >
        <span style={{ marginRight: '0.35rem' }}>{currentLanguage?.flag || '🌐'}</span>
        <span>{currentLanguage?.code.toUpperCase() || 'EN'}</span>
        <span style={{ marginLeft: '0.35rem', fontSize: '0.75rem' }}>{isOpen ? '▲' : '▼'}</span>
      </button>
      {isOpen && (
        <div className="language-switcher-dropdown">
          {visibleLanguages.map((lang) => (
            <button
              key={lang.code}
              type="button"
              onClick={() => switchLanguage(lang.code)}
              className={`language-switcher-option ${currentLocale === lang.code ? 'active' : ''}`}
              aria-label={`Switch to ${lang.name}`}
            >
              <span style={{ marginRight: '0.5rem' }}>{lang.flag}</span>
              <span>{lang.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

