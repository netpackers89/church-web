/** Skeleton placeholders for loading states. */

export function Skeleton({ height = '1rem', width = '100%', radius = 'var(--r-md)', style }) {
  return <div className="skeleton" style={{ height, width, borderRadius: radius, ...style }} aria-hidden="true" />;
}

export function TextLines({ lines = 3 }) {
  return (
    <div className="stack" style={{ gap: '0.6rem' }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} width={i === lines - 1 ? '60%' : '100%'} />
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="card">
      <Skeleton height="11rem" radius="0" />
      <div className="card-body">
        <TextLines lines={3} />
      </div>
    </div>
  );
}

export function StatSkeleton() {
  return (
    <div className="stat-card">
      <Skeleton height="0.8rem" width="50%" />
      <Skeleton height="2rem" width="70%" />
      <Skeleton height="0.7rem" width="40%" />
    </div>
  );
}

export default Skeleton;

