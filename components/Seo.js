import Head from 'next/head'
import { useRouter } from 'next/router'
import { truncateText, toPlainText } from '../lib/text'

const SITE_NAME = 'KT SERVITOR'
const DEFAULT_DESCRIPTION = 'KT Servitor is a fast, offline-capable reference for Warhammer 40,000: Kill Team factions, rules, and operatives.'
const FALLBACK_IMAGE = '/icons/icon-512.png'
const DEFAULT_TYPE = 'website'

const RAW_BASE_URL =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_SITE_URL) ||
  'https://ktservitor.xdavidleon.com'

function buildCanonicalUrl(router) {
  const base = RAW_BASE_URL.replace(/\/+$/, '')
  if (!router?.asPath) return base

  const path = router.asPath.split('#')[0]
  const cleanPath = path.split('?')[0]

  if (!cleanPath || cleanPath === '/') {
    return base
  }

  if (cleanPath.includes('[')) {
    return base
  }

  return `${base}${cleanPath.startsWith('/') ? '' : '/'}${cleanPath}`
}

export default function Seo({
  title,
  description,
  image,
  type = DEFAULT_TYPE,
  canonical
}) {
  const router = useRouter()

  const baseTitle = title ? toPlainText(title) : ''
  const pageTitle = baseTitle ? `${baseTitle} | ${SITE_NAME}` : SITE_NAME
  const metaDescription = truncateText(description || DEFAULT_DESCRIPTION)
  const ogImage = image || FALLBACK_IMAGE
  const canonicalUrl = canonical || buildCanonicalUrl(router)
  const normalizedBase = RAW_BASE_URL.replace(/\/+$/, '')
  const absoluteOgImage = ogImage.startsWith('http')
    ? ogImage
    : `${normalizedBase}${ogImage.startsWith('/') ? '' : '/'}${ogImage}`

  return (
    <Head>
      <title>{pageTitle}</title>
      <meta name="description" content={metaDescription} key="description" />
      <meta name="robots" content="index,follow" />

      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={pageTitle} />
      <meta property="og:description" content={metaDescription} />
      <meta property="og:type" content={type} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:image" content={absoluteOgImage} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={pageTitle} />
      <meta name="twitter:description" content={metaDescription} />
      <meta name="twitter:image" content={absoluteOgImage} />

      <link rel="canonical" href={canonicalUrl} key="canonical" />
    </Head>
  )
}
