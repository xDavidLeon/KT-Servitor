// components/Header.js
import React from 'react'
import Nav from './Nav'
import LanguageSwitcher from './LanguageSwitcher'

export default function Header() {
  return (
    <div className="card header-sticky">
      <LanguageSwitcher />
      <div
        className="header-top-row"
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '0.15rem 0'
        }}
      >
        <div
          className="heading"
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '1rem'
          }}
        >
          <img
            src="/icons/icon-head.png"
            alt="KT Servitor icon"
            style={{
              width: '3.25rem',
              height: '3.25rem',
              background: 'transparent'
            }}
            onError={event => {
              event.currentTarget.onerror = null
              event.currentTarget.src = '/icons/icon.png'
            }}
          />
          <h1
            style={{
              margin: 0,
              fontFamily: "'Orbitron', monospace",
              fontSize: '2rem',
              fontWeight: 700,
              letterSpacing: '0.1em',
              color: 'var(--text)',
              textTransform: 'uppercase'
            }}
          >
            KT SERVITOR
          </h1>
        </div>
      </div>

      <div style={{ marginTop: '0.5rem' }}>
        <Nav />
      </div>
    </div>
  )
}
