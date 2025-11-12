import Head from 'next/head'
import Footer from '../components/Footer'
import '../styles.css'

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
        <link
          rel="icon"
          type="image/png"
          href="/icons/icon-512.png"
        />
        <link rel="icon" href="/icons/icon-192.png" sizes="192x192" />
        <link rel="icon" href="/icons/icon-512.png" sizes="512x512" />
        <link
          rel="apple-touch-icon"
          href="/icons/icon-512.png"
        />
        <link rel="apple-touch-icon" href="/icons/icon-512.png" />
        <link rel="manifest" href="/manifest.json" />
      </Head>
      <Component {...pageProps} />
      <Footer />
    </>
  )
}
