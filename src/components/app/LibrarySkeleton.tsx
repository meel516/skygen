export function LibrarySkeleton({ label = 'Loading library' }: { label?: string }) {
  return <div className="mt-8 space-y-6" role="status" aria-label={label}>
    {[0, 1, 2, 3].map(row => <div key={row} className="flex gap-5 border-b border-border pb-6" aria-hidden="true"><div className="h-20 w-24 shrink-0 bg-muted" /><div className="flex-1 space-y-3 pt-2"><div className="h-4 w-2/5 bg-muted" /><div className="h-3 w-3/4 bg-muted" /><div className="h-3 w-1/2 bg-muted" /></div></div>)}
    <span className="sr-only">{label}</span>
  </div>;
}
