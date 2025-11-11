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
            justifyContent: 'center',
            width: '100%'
          }}
        >
          <img
            src="/icons/ktservitor_icon_01.png"
            alt="KT Servitor icon"
            style={{
              width: '3.25rem',
              height: '3.25rem',
              borderRadius: '0.9rem',
              boxShadow: '0 0 0.75rem rgba(0, 0, 0, 0.4)'
            }}
            onError={event => {
              event.currentTarget.onerror = null
              event.currentTarget.src = '/icons/icon-512.png'
            }}
          />
        </div>
      </div>

      <div style={{ marginTop: '0.5rem' }}>
        <Nav />
      </div>
    </div>
  )
}
