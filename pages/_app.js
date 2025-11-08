import Head from 'next/head'
import '../styles.css'
export default function App({Component, pageProps}) {
  return (<>
    <Head>
      <meta name="viewport" content="width=device-width, initial-scale=1"/>
      <link rel="manifest" href="/manifest.json" />
    </Head>
    <Component {...pageProps}/>
  </>)
}
