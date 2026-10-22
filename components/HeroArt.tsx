/** Decorative, code-native artwork. All controls and labels remain real HTML. */
export function HeroArt() {
  return (
    <svg className="hero-art" viewBox="0 0 650 480" aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="art-card" x1="0" x2="1" y1="0" y2="1">
          <stop stopColor="#ffffff" />
          <stop offset="1" stopColor="#f9faff" />
        </linearGradient>
        <linearGradient id="art-accent" x1="0" x2="1" y1="0" y2="1">
          <stop stopColor="#ed7690" />
          <stop offset="1" stopColor="#bb3754" />
        </linearGradient>
        <filter id="art-shadow" x="-30%" y="-30%" width="160%" height="180%">
          <feDropShadow dx="0" dy="18" stdDeviation="20" floodColor="#303a63" floodOpacity="0.14" />
        </filter>
      </defs>
      <circle cx="395" cy="238" r="194" fill="#eaeafd" />
      <circle cx="395" cy="238" r="151" fill="#f3f1ff" />
      <circle cx="580" cy="93" r="14" fill="#ffd9b8" />
      <circle cx="128" cy="369" r="8" fill="#aec8fc" />
      <path d="M102 162l6 17 17 6-17 6-6 17-6-17-17-6 17-6Z" fill="#e994a8" />
      <path d="M573 345l4 12 12 4-12 4-4 12-4-12-12-4 12-4Z" fill="#9ca9e6" />
      <g filter="url(#art-shadow)" className="hero-art-card hero-art-card-back" transform="rotate(8 415 215)">
        <rect x="286" y="73" width="258" height="300" rx="24" fill="url(#art-card)" stroke="#e3e6f2" />
        <rect x="309" y="101" width="108" height="13" rx="6.5" fill="#d9def4" />
        <rect x="309" y="129" width="184" height="9" rx="4.5" fill="#ecedf5" />
        <rect x="309" y="149" width="154" height="9" rx="4.5" fill="#ecedf5" />
        <rect x="309" y="186" width="211" height="106" rx="14" fill="#eef7ff" />
        <circle cx="371" cy="232" r="28" fill="#d4e9ff" />
        <path d="m333 270 43-38 27 21 30-31 61 48Z" fill="#94b6e7" />
        <rect x="309" y="319" width="130" height="9" rx="4.5" fill="#ecedf5" />
      </g>
      <g filter="url(#art-shadow)" className="hero-art-card hero-art-card-front" transform="rotate(-8 333 263)">
        <rect x="181" y="142" width="274" height="278" rx="25" fill="url(#art-card)" stroke="#e3e6f2" />
        <rect x="207" y="167" width="56" height="56" rx="15" fill="#fde8ed" />
        <path d="M224 179h17l8 8v24h-25Z" fill="#d65c76" />
        <path d="M241 179v9h8" fill="none" stroke="#fff" strokeWidth="2" />
        <rect x="278" y="174" width="119" height="12" rx="6" fill="#2b3651" />
        <rect x="278" y="197" width="83" height="9" rx="4.5" fill="#ccd3e4" />
        <rect x="207" y="251" width="208" height="11" rx="5.5" fill="#e9ecf6" />
        <rect x="207" y="275" width="175" height="11" rx="5.5" fill="#e9ecf6" />
        <rect x="207" y="299" width="195" height="11" rx="5.5" fill="#e9ecf6" />
        <rect x="207" y="352" width="130" height="42" rx="14" fill="url(#art-accent)" />
        <path d="M243 373h54m-8-8 8 8-8 8" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <g className="hero-art-chip" filter="url(#art-shadow)">
        <rect x="463" y="331" width="140" height="58" rx="20" fill="#fff" stroke="#e3e6f2" />
        <circle cx="492" cy="360" r="15" fill="#e3f6ee" />
        <path d="m485 360 5 5 9-11" fill="none" stroke="#18815b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="516" y="350" width="64" height="9" rx="4.5" fill="#374762" />
        <rect x="516" y="368" width="43" height="7" rx="3.5" fill="#cbd3e3" />
      </g>
    </svg>
  );
}
