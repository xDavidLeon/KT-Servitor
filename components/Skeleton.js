// Reusable skeleton components for loading states

export function SkeletonLine({ width = '100%', height = '1rem', style, className = '' }) {
  return (
    <div
      className={`skeleton-line ${className}`}
      style={{
        width,
        height,
        borderRadius: '4px',
        ...style
      }}
    />
  )
}

export function SkeletonCircle({ size = '40px', style, className = '' }) {
  return (
    <div
      className={`skeleton-circle ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        ...style
      }}
    />
  )
}

export function SkeletonBox({ width = '100%', height = '100px', style, className = '' }) {
  return (
    <div
      className={`skeleton-box ${className}`}
      style={{
        width,
        height,
        borderRadius: '4px',
        ...style
      }}
    />
  )
}

// Operative Card Skeleton
export function OperativeCardSkeleton() {
  return (
    <div className="operative-card">
      <div className="operative-header">
        <div style={{ marginBottom: '0.75rem' }}>
          <SkeletonLine width="70%" height="24px" />
        </div>
        <div className="operative-header-stats" style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="operative-header-stat" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
              <SkeletonCircle size="50px" />
              <SkeletonLine width="30px" height="12px" />
            </div>
          ))}
        </div>
      </div>
      <div style={{ marginTop: '1rem' }}>
        <SkeletonLine width="100%" height="16px" />
        <SkeletonLine width="85%" height="16px" style={{ marginTop: '0.5rem' }} />
        <SkeletonLine width="90%" height="16px" style={{ marginTop: '0.5rem' }} />
      </div>
      <div style={{ marginTop: '1.5rem' }}>
        <SkeletonLine width="40%" height="20px" />
        <div style={{ marginTop: '0.75rem' }}>
          <SkeletonLine width="100%" height="14px" />
          <SkeletonLine width="95%" height="14px" style={{ marginTop: '0.4rem' }} />
        </div>
      </div>
      <div style={{ marginTop: '1.5rem' }}>
        <SkeletonLine width="60%" height="18px" />
        <div style={{ marginTop: '0.5rem' }}>
          <SkeletonLine width="100%" height="12px" />
          <SkeletonLine width="80%" height="12px" style={{ marginTop: '0.3rem' }} />
        </div>
      </div>
    </div>
  )
}

// Results Table Skeleton
export function ResultsTableSkeleton({ rowCount = 8 }) {
  return (
    <div className="card">
      <div className="results-summary" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
        <SkeletonLine width="200px" height="20px" />
        <div className="results-pagination" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <SkeletonLine width="60px" height="32px" style={{ borderRadius: '6px' }} />
          <SkeletonLine width="100px" height="20px" />
          <SkeletonLine width="60px" height="32px" style={{ borderRadius: '6px' }} />
        </div>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Type</th>
              <th>Team</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rowCount }).map((_, i) => (
              <tr key={i}>
                <td>
                  <SkeletonLine width="60%" height="16px" />
                </td>
                <td>
                  <SkeletonLine width="40%" height="16px" />
                </td>
                <td>
                  <SkeletonLine width="50%" height="16px" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Kill Team Page Skeleton
export function KillTeamPageSkeleton() {
  return (
    <>
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ position: 'relative' }}>
          <SkeletonLine width="50%" height="32px" />
          <div style={{ marginTop: '0.75rem' }}>
            <SkeletonLine width="30%" height="24px" style={{ borderRadius: '4px' }} />
          </div>
          <div style={{ marginTop: '1rem' }}>
            <SkeletonLine width="100%" height="16px" />
            <SkeletonLine width="95%" height="16px" style={{ marginTop: '0.5rem' }} />
            <SkeletonLine width="90%" height="16px" style={{ marginTop: '0.5rem' }} />
          </div>
        </div>
      </div>
      <div className="card">
        <SkeletonLine width="40%" height="24px" style={{ marginBottom: '1rem' }} />
        <div className="operatives-grid" style={{ marginTop: '0.5rem' }}>
          {[1, 2, 3, 4].map(i => (
            <OperativeCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </>
  )
}

