export default function LazySectionFallback({ label = "Bereich wird geladen…" }) {
  return (
    <section className="row">
      <div className="card glassStrong">
        <div className="emptyStateCard">{label}</div>
      </div>
    </section>
  );
}
