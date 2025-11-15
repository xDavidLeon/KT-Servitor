import { useEffect, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { QueryClientProvider } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import Footer from '../components/Footer'
import { createQueryClient } from '../lib/queryClient'
import { useDatasetBootstrap } from '../hooks/useDatasetBootstrap'
import '../styles.css'

const QUERY_CACHE_STORAGE_KEY = 'kt-react-query-cache'
const ONE_DAY = 1000 * 60 * 60 * 24

function DatasetWarmup() {
  const router = useRouter()
  const locale = router?.locale || 'en'
  useDatasetBootstrap(locale)
  return null
}

function AppProviders({ children }) {
  const [queryClient] = useState(() => createQueryClient())
  const [persister, setPersister] = useState(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const storage = window.localStorage
      if (!storage) return
      const nextPersister = createSyncStoragePersister({
        storage,
        key: QUERY_CACHE_STORAGE_KEY,
        throttleTime: 1000,
        serialize: data => JSON.stringify(data),
        deserialize: data => JSON.parse(data)
      })
      setPersister(nextPersister)
    } catch (err) {
      console.warn('Failed to initialise query cache persistence', err)
    }
  }, [])

  const content = (
    <>
      {children}
      <DatasetWarmup />
    </>
  )

  if (!persister) {
    return <QueryClientProvider client={queryClient}>{content}</QueryClientProvider>
  }

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: ONE_DAY,
        dehydrateOptions: {
          shouldDehydrateQuery: ({ state }) => state.status === 'success'
        }
      }}
    >
      {content}
    </PersistQueryClientProvider>
  )
}

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        <meta charSet="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1"
        />
        <meta name="theme-color" content="#0e1016" />
        <meta name="application-name" content="KT SERVITOR" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/icons/favicon-16x16.png" />
        <link rel="icon" href="/icons/android-chrome-192x192.png" sizes="192x192" />
        <link rel="icon" href="/icons/android-chrome-512x512.png" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
      </Head>
      <AppProviders>
        <Component {...pageProps} />
        <Footer />
      </AppProviders>
    </>
  )
}
