export function WorkspaceSkeleton() {
  return <div className="workspace-skeleton" role="status" aria-label="Loading workspace">
    <div className="skeleton-nav"><span className="studio-wordmark">SKYGEN</span><i /><i /><i /><i /></div>
    <div className="skeleton-content"><div className="skeleton-heading" /><div className="skeleton-columns"><div /><div /></div><span className="sr-only">Loading your workspace...</span></div>
  </div>;
}
