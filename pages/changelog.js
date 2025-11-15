// pages/changelog.js
// Standalone changelog page

import { useState } from 'react'
import Head from 'next/head'
import Header from '../components/Header'
import Changelog from '../components/Changelog'
import Seo from '../components/Seo'

export default function ChangelogPage() {
  return (
    <>
      <Seo 
        title="Changelog" 
        description="View recent changes and updates to KT Servitor data"
      />
      <div className="container">
        <Header />
        <Changelog />
      </div>
    </>
  )
}

