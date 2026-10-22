import { Monogram } from './Brand';

/** Shared loading state for route transitions and lazily loaded tools. */
export function ToolLoading({ name }: { name?: string }) {
  return (
    <div className="tool-loading" role="status" aria-live="polite" aria-atomic="true">
      <div className="tool-loading-card">
        <div className="tool-loading-emblem" aria-hidden="true">
          <span className="tool-loading-orbit tool-loading-orbit-one" />
          <span className="tool-loading-orbit tool-loading-orbit-two" />
          <span className="tool-loading-core"><Monogram size={37} /></span>
          <span className="tool-loading-spark tool-loading-spark-one" />
          <span className="tool-loading-spark tool-loading-spark-two" />
        </div>
        <span className="tool-loading-kicker">UsamaVerse</span>
        <strong>Making space for your next idea</strong>
        <span className="tool-loading-detail">{name ? `Opening ${name}…` : 'Opening your workspace…'}</span>
        <span className="tool-loading-track" aria-hidden="true"><span /></span>
      </div>
    </div>
  );
}
