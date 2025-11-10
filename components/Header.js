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
        </div>
      </div>

      <div style={{ marginTop: '0.5rem' }}>
        <Nav />
      </div>
    </div>
  )
}
