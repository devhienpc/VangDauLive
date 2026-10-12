// src/components/SkeletonTable.tsx – Placeholder khi đang tải

export function SkeletonTable() {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
      {/* Header skeleton */}
      <div className="px-4 py-3" style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="skeleton h-3 w-32 rounded" />
      </div>

      {/* Row skeletons */}
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center justify-between px-4 py-4"
          style={{ borderBottom: i < 4 ? '1px solid var(--border-subtle)' : 'none', background: 'var(--bg-glass)' }}
        >
          <div className="space-y-2">
            <div className="skeleton h-3.5 rounded" style={{ width: `${100 + i * 20}px` }} />
            <div className="skeleton h-2.5 w-16 rounded" />
          </div>
          <div className="flex gap-6">
            <div className="skeleton h-3.5 w-20 rounded" />
            <div className="skeleton h-3.5 w-20 rounded" />
            <div className="skeleton h-3 w-16 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
