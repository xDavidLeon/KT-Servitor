import RichText from '../RichText'
import ShareButton from '../ShareButton'

export default function OverviewSection({ killteam, killteamTitle, archetypes, factionKeyword, shareUrl }) {
  return (
    <section id="killteam-overview" className="card killteam-tab-panel" style={{ position: 'relative' }}>
      <div
        style={{
          position: 'absolute',
          top: '1rem',
          right: '1rem',
          zIndex: 10,
          display: 'flex',
          gap: '0.5rem',
          alignItems: 'center'
        }}
      >
        {shareUrl && (
          <ShareButton
            title={killteamTitle}
            text={`Check out ${killteamTitle} on KT Servitor`}
            url={shareUrl}
            size="medium"
          />
        )}
        {(killteam?.file && killteam?.version) && (
          <a
            href={killteam.file}
            target="_blank"
            rel="noreferrer"
            className="pill-button"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              justifyContent: 'center',
              padding: '0.4rem 0.8rem',
              fontSize: '0.95rem'
            }}
            aria-label="Open designer notes PDF"
          >
            <span aria-hidden="true" style={{ fontSize: '1.1rem' }}>🔄</span>
            <span>{killteam.version}</span>
          </a>
        )}
      </div>
      <div style={{ marginBottom: '0.75rem' }}>
        <h2 style={{ margin: 0 }}>{killteamTitle.toUpperCase()}</h2>
        {archetypes.length > 0 && (
          <div style={{ 
            marginTop: '0.5rem', 
            color: '#ffffff',
            background: '#F55A07',
            padding: '0.5rem 0.75rem',
            borderRadius: '4px',
            width: '100%',
            boxSizing: 'border-box'
          }}>
            <strong>ARCHETYPE:</strong> {archetypes.map(a => a.toUpperCase()).join(', ')}
          </div>
        )}
      </div>
      {killteam.description && <RichText className="muted" text={killteam.description} style={{ color: '#ffffff' }} highlightText={factionKeyword} />}
      {killteam.composition && (
        <div id="killteam-composition" style={{ marginTop: '1.5rem' }}>
          <h3 style={{ marginTop: 0, borderBottom: '2px solid #F55A07', paddingBottom: '0.5rem' }}>OPERATIVES</h3>
          <RichText className="muted" text={killteam.composition} style={{ color: '#ffffff' }} highlightText={factionKeyword} />
        </div>
      )}
    </section>
  )
}

