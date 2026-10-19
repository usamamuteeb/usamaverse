/**
 * Original decorative illustration (inline SVG, ~3 KB): a blood-red moon behind
 * drifting mist and a few crows. No third-party or character artwork.
 * Replace with licensed art by swapping this component; keep it aria-hidden.
 */
export function HeroArt() {
  const crow = 'M0 6c3-1 6-4 9-4 2 0 3 1 4 2 1-1 3-3 6-3-2 1-3 3-4 5 2 0 4 1 5 2-3 0-5 0-7 1-2 1-4 3-7 3 1-1 2-2 2-3-3 0-6-1-8-3Z';
  return (
    <svg className="hero-art" viewBox="0 0 600 420" aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id="moon" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#F04459" stopOpacity="0.95" />
          <stop offset="55%" stopColor="#C6283D" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#5A0E1A" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="mist" x1="0" x2="1">
          <stop offset="0%" stopColor="#141217" stopOpacity="0" />
          <stop offset="50%" stopColor="#1D1920" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#141217" stopOpacity="0" />
        </linearGradient>
      </defs>
      <circle cx="400" cy="170" r="150" fill="url(#moon)" className="hero-moon" />
      <circle cx="400" cy="170" r="104" fill="none" stroke="#F5F0F2" strokeOpacity="0.08" strokeWidth="1" />
      <g className="hero-mist">
        <path d="M-20 300c80-30 160-30 240-5s170 25 250-10 140-20 160-5v160H-20Z" fill="url(#mist)" />
        <path d="M-20 340c90-20 190-25 280 0s200 15 340-20v120H-20Z" fill="#0B0A0D" opacity="0.85" />
      </g>
      <g fill="#0B0A0D" className="hero-crows">
        <path d={crow} transform="translate(300 120) scale(2.2)" />
        <path d={crow} transform="translate(360 210) scale(1.4) rotate(-8)" />
        <path d={crow} transform="translate(470 95) scale(1.1) rotate(6)" />
        <path d={crow} transform="translate(250 200) scale(0.9) rotate(-4)" opacity="0.8" />
      </g>
    </svg>
  );
}
