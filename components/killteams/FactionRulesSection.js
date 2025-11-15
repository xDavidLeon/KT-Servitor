import ErrorBoundary from '../ErrorBoundary'
import RichText from '../RichText'

export default function FactionRulesSection({ factionRules, factionKeyword }) {
  return (
    <section id="faction-rules" className="card killteam-tab-panel">
      <ErrorBoundary 
        fallbackMessage="Failed to load faction rules"
        showDetails={process.env.NODE_ENV === 'development'}
      >
        {factionRules.length > 0 ? (
          <div className="card-section-list">
            {factionRules.map((rule, idx) => (
              <ErrorBoundary 
                key={rule.anchorId || rule.name || idx}
                fallbackMessage={`Failed to load rule: ${rule.name || 'Unknown'}`}
                showDetails={false}
              >
                <div
                  id={rule.anchorId}
                  className="ability-card ability-card-item"
                >
                  <div className="ability-card-header">
                    <h4 className="ability-card-title" style={{ color: '#F55A07' }}>{(rule.name || 'Rule').toUpperCase()}</h4>
                    {rule.apCost && <span className="ability-card-ap">{rule.apCost}</span>}
                  </div>
                  {rule.description && (
                    <RichText className="ability-card-body" text={rule.description} highlightText={factionKeyword} />
                  )}
                </div>
              </ErrorBoundary>
            ))}
          </div>
        ) : (
          <div className="muted">No faction rules available.</div>
        )}
      </ErrorBoundary>
    </section>
  )
}

