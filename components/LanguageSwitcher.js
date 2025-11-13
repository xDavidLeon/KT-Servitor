import { useRouter } from 'next/router'
import { useLocale } from '../lib/i18n'

const languages = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'es', name: 'Español', flag: '🇪🇸' }
]

export default function LanguageSwitcher() {
  const router = useRouter()
  const currentLocale = useLocale()

  const switchLanguage = (locale) => {
    router.push(router.asPath, router.asPath, { locale })
  }

  return (
    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
      {languages.map((lang) => (
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

