import ErrorBoundary from '../ErrorBoundary'
import OperativeCard from '../OperativeCard'

export default function OperativesSection({ operatives, operativesVirtualizer, operativesScrollRef }) {

  return (
    <section id="operatives" className="card killteam-tab-panel">
      {operatives.length ? (
        <div
          ref={operativesScrollRef}
          className="operatives-grid"
          style={{
            position: 'relative',
            minHeight: `${operativesVirtualizer.getTotalSize()}px`
          }}
        >
          {operativesVirtualizer.getVirtualItems().map((virtualItem) => {
            const operative = operatives[virtualItem.index]
            const operativeId = operative?.id ? `operative-${operative.id}` : `operative-${virtualItem.index + 1}`
            return (
              <div
                key={virtualItem.key}
                id={operativeId}
                data-index={virtualItem.index}
                ref={(node) => {
                  if (node && node instanceof Element) {
                    operativesVirtualizer.measureElement(node)
                  }
                }}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualItem.start}px)`,
                  willChange: 'transform'
                }}
              >
                <ErrorBoundary 
                  fallbackMessage={`Failed to load ${operative?.name || 'operative'} data`}
                  showDetails={process.env.NODE_ENV === 'development'}
                >
                  <OperativeCard operative={operative} />
                </ErrorBoundary>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="muted">No operatives listed for this kill team.</div>
      )}
    </section>
  )
}

