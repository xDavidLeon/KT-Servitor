// components/Header.js
import React from 'react'
import Nav from './Nav'

export default function Header() {
  return (
    <div className="card header-sticky">
      <div
        className="header-top-row"
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '0.25rem 0'
        }}
      >
        <div
          className="heading"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            textAlign: 'center'
          }}
        >
          <h1
            style={{
              margin: 0,
              width: '100%',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              textAlign: 'center'
            }}
          >
            KT SERVITOR
          </h1>
          <p
            style={{
              margin: '0.35rem 0 0',
              fontSize: '0.85rem',
              letterSpacing: '0.05em'
            }}
          >
            Kill Team reference app
          </p>
        </div>
      </div>

      <div style={{ marginTop: '0.5rem' }}>
        <Nav />
      </div>
    </div>
  )
}
