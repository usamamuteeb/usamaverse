import { siteConfig } from '@/lib/site';

/** Original abstract mark: a crimson ring with a narrow vertical iris. Replaceable. */
export function Monogram({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false" className="monogram">
      <circle cx="16" cy="16" r="14" fill="none" stroke="var(--red)" strokeWidth="2.5" />
      <circle cx="16" cy="16" r="8.5" fill="var(--red)" opacity="0.18" />
      <path d="M16 7.5c2.6 3 2.6 14 0 17-2.6-3-2.6-14 0-17Z" fill="var(--red-bright)" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="wordmark">
      <Monogram />
      <span className="wordmark-text">{siteConfig.name}</span>
    </span>
  );
}
