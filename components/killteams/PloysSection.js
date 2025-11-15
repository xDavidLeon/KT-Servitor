import ErrorBoundary from '../ErrorBoundary'
import RichText from '../RichText'

export default function PloysSection({ strategyPloys, firefightPloys, factionKeyword }) {
  return (
    <section id="ploys" className="card killteam-tab-panel">
      <ErrorBoundary 
        fallbackMessage="Failed to load ploys"
        showDetails={process.env.NODE_ENV === 'development'}
      >
        {strategyPloys.length || firefightPloys.length ? (
          <>
            {strategyPloys.length > 0 && (
              <div className="card-section-list">
                {strategyPloys.map((ploy, idx) => (
                  <ErrorBoundary 
                    key={ploy.id || idx}
                    fallbackMessage={`Failed to load ploy: ${ploy.name || 'Unknown'}`}
                    showDetails={false}
                  >
                    <div id={ploy.anchorId} className="ability-card ploy-card">
                      <div className="ability-card-header" style={{ background: '#3F5C4D', padding: '0.5rem 0.75rem', margin: '-0.5rem -0.5rem 0.5rem -0.5rem', borderRadius: '8px 8px 0 0' }}>
                        <h4 className="ability-card-title" style={{ color: '#ffffff' }}>{(ploy.name || '').toUpperCase()}</h4>
                        {ploy.cost && <span className="ability-card-ap">{ploy.cost}</span>}
                      </div>
                      {ploy.description && <RichText className="ability-card-body" text={ploy.description} highlightText={factionKeyword} />}
                    </div>
                  </ErrorBoundary>
                ))}
              </div>
            )}

            {firefightPloys.length > 0 && (
              <div className="card-section-list" style={{ marginTop: strategyPloys.length > 0 ? '0.75rem' : 0 }}>
                {firefightPloys.map((ploy, idx) => (
                  <ErrorBoundary 
                    key={ploy.id || idx}
                    fallbackMessage={`Failed to load ploy: ${ploy.name || 'Unknown'}`}
                    showDetails={false}
                  >
                    <div id={ploy.anchorId} className="ability-card ploy-card">
                      <div className="ability-card-header" style={{ background: '#333333', padding: '0.5rem 0.75rem', margin: '-0.5rem -0.5rem 0.5rem -0.5rem', borderRadius: '8px 8px 0 0' }}>
                        <h4 className="ability-card-title" style={{ color: '#ffffff' }}>{(ploy.name || '').toUpperCase()}</h4>
                        {ploy.cost && <span className="ability-card-ap">{ploy.cost}</span>}
                      </div>
                      {ploy.description && <RichText className="ability-card-body" text={ploy.description} highlightText={factionKeyword} />}
                    </div>
                  </ErrorBoundary>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="muted">No ploys available.</div>
        )}
      </ErrorBoundary>
    </section>
  )
}

