import { useRouter } from 'next/router'
import { useMemo, useCallback } from 'react'

const translations = {
  en: require('../messages/en.json'),
  fr: require('../messages/fr.json'),
  es: require('../messages/es.json')
}

export function useTranslations(namespace) {
  const router = useRouter()
  const locale = router.locale || 'en'
  
  const t = useMemo(() => {
    const translationData = translations[locale] || translations.en
    const namespaceData = namespace ? translationData[namespace] : translationData
    
    return (key, params = {}) => {
      const keys = key.split('.')
      let value = namespaceData
      
      for (const k of keys) {
        if (value && typeof value === 'object') {
          value = value[k]
        } else {
          // Fallback to English if translation not found
          const enT = translations.en
          const enNamespaceData = namespace ? enT[namespace] : enT
          let enValue = enNamespaceData
          for (const enK of keys) {
            if (enValue && typeof enValue === 'object') {
              enValue = enValue[enK]
            } else {
              return key
            }
          }
          value = enValue
          break
        }
      }
      
      if (typeof value !== 'string') {
        return key
      }
      
      // Simple parameter replacement
      return value.replace(/\{(\w+)\}/g, (match, paramKey) => {
        return params[paramKey] !== undefined ? params[paramKey] : match
      })
    }
  }, [locale, namespace])
  
  return t
}

export function useLocale() {
  const router = useRouter()
  return router.locale || 'en'
}

