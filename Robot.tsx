export default function Robot({size = 84, talk = false}: {size?: number; talk?: boolean}) {
  return (
    <svg className={'robot' + (talk ? ' talk' : '')} width={size} height={size} viewBox="0 0 120 120" role="img" aria-label="NEXUS robot mascot">
      <defs>
        <linearGradient id="rm" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#58587a"/><stop offset=".5" stopColor="#1c1c30"/><stop offset="1" stopColor="#0b0b18"/></linearGradient>
        <linearGradient id="rg" x1="0" x2="1"><stop offset="0" stopColor="#a855f7"/><stop offset="1" stopColor="#38bdf8"/></linearGradient>
        <radialGradient id="re"><stop offset="0" stopColor="#fff"/><stop offset=".45" stopColor="#c4b5fd"/><stop offset="1" stopColor="#7c3aed"/></radialGradient>
        <filter id="gl" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <line x1="60" y1="12" x2="60" y2="26" stroke="url(#rg)" strokeWidth="3"/>
      <circle className="ant" cx="60" cy="10" r="4" fill="#38bdf8" filter="url(#gl)"/>
      <rect x="9" y="52" width="10" height="26" rx="5" fill="url(#rg)" filter="url(#gl)"/>
      <rect x="101" y="52" width="10" height="26" rx="5" fill="url(#rg)" filter="url(#gl)"/>
      <rect x="18" y="24" width="84" height="76" rx="26" fill="url(#rm)" stroke="url(#rg)" strokeWidth="2"/>
      <path d="M30 35Q60 24 90 35" stroke="#fff" strokeOpacity=".28" strokeWidth="3" fill="none" strokeLinecap="round"/>
      <rect x="28" y="44" width="64" height="38" rx="17" fill="#05050c" stroke="#7c3aed" strokeOpacity=".6"/>
      <g className="eyes" filter="url(#gl)"><ellipse cx="46" cy="63" rx="8" ry="9.5" fill="url(#re)"/><ellipse cx="74" cy="63" rx="8" ry="9.5" fill="#bae6fd"/></g>
      <path d="M47 91h26" stroke="url(#rg)" strokeWidth="3" strokeLinecap="round" opacity=".85"/>
    </svg>
  );
}
