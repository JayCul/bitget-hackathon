// Thesis node branching into two symmetrical paths of 5 event markers, with slow pulses and a
// faint timeline. SVG + SMIL/CSS only; pulses are hidden under prefers-reduced-motion.
const MARKERS = [0, 1, 2, 3, 4];
const X0 = 250;
const DX = 78;

function branch(dir: 1 | -1) {
  const y = 210 + dir * 118;
  return `M112 210 C 170 210, 180 ${y}, 240 ${y} L ${X0 + DX * 4 + 30} ${y}`;
}

export function HeroGraphic() {
  return (
    <svg viewBox="0 0 640 440" className="h-auto w-full" role="img" aria-label="A thesis node branching into five events that would break it and five that would confirm it">
      <defs>
        <radialGradient id="node-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="fade-r" x1="0" x2="1">
          <stop offset="0%" stopColor="var(--color-cool)" stopOpacity="0.7" />
          <stop offset="100%" stopColor="var(--color-cool)" stopOpacity="0.15" />
        </linearGradient>
        <path id="branch-up" d={branch(-1)} />
        <path id="branch-down" d={branch(1)} />
      </defs>

      {/* faint timeline */}
      <g opacity="0.5">
        <line x1="112" x2="620" y1="408" y2="408" stroke="var(--color-line-strong)" />
        {MARKERS.map((i) => (
          <g key={i}>
            <line x1={X0 + DX * i} x2={X0 + DX * i} y1="404" y2="412" stroke="var(--color-line-strong)" />
            <text x={X0 + DX * i} y="430" textAnchor="middle" fontSize="10" fontFamily="var(--font-mono)" fill="var(--color-muted)">
              {`T+${(i + 1) * 4}d`}
            </text>
          </g>
        ))}
        <text x="112" y="430" textAnchor="middle" fontSize="10" fontFamily="var(--font-mono)" fill="var(--color-muted)">
          today
        </text>
      </g>

      {/* guide lines from markers down to the timeline */}
      {MARKERS.map((i) => (
        <line key={i} x1={X0 + DX * i} x2={X0 + DX * i} y1="92" y2="328" stroke="var(--color-line)" strokeDasharray="2 5" />
      ))}

      {/* branches */}
      <use href="#branch-up" fill="none" stroke="url(#fade-r)" strokeWidth="1.4" />
      <use href="#branch-down" fill="none" stroke="url(#fade-r)" strokeWidth="1.4" />

      {/* markers */}
      {([-1, 1] as const).map((dir) =>
        MARKERS.map((i) => {
          const x = X0 + DX * i;
          const y = 210 + dir * 118;
          const red = dir === -1;
          const fired = (red && i === 2) || (!red && i === 3);
          return (
            <g key={`${dir}-${i}`}>
              <rect x={x - 1} y={y - 11} width="2" height="22" rx="1" fill={red ? "var(--color-red)" : "var(--color-green)"} opacity={fired ? 1 : 0.55} />
              {fired ? <circle cx={x} cy={y} r="9" fill="none" stroke="var(--color-accent)" strokeOpacity="0.6" className="hero-ring" /> : null}
              <text
                x={x}
                y={y + dir * 26 + (dir === 1 ? 4 : 0)}
                textAnchor="middle"
                fontSize="10"
                fontFamily="var(--font-mono)"
                fill="var(--color-muted)"
              >
                {`${red ? "R" : "G"}${i + 1}`}
              </text>
            </g>
          );
        }),
      )}

      {/* pulses travelling along each branch */}
      {(["branch-up", "branch-down"] as const).map((id, k) => (
        <circle key={id} r="3" fill="var(--color-accent)" opacity="0" className="hero-pulse">
          <animateMotion dur="7s" begin={`${k * 3.5}s`} repeatCount="indefinite" rotate="auto" keyPoints="0;1" keyTimes="0;1" calcMode="linear">
            <mpath href={`#${id}`} />
          </animateMotion>
          <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.85;1" dur="7s" begin={`${k * 3.5}s`} repeatCount="indefinite" />
        </circle>
      ))}

      {/* thesis node */}
      <circle cx="112" cy="210" r="46" fill="url(#node-glow)" />
      <circle cx="112" cy="210" r="11" fill="var(--color-accent)" />
      <circle cx="112" cy="210" r="19" fill="none" stroke="var(--color-accent)" strokeOpacity="0.35" />
      <text x="112" y="258" textAnchor="middle" fontSize="11" fontFamily="var(--font-mono)" fill="var(--color-muted)">
        thesis
      </text>
      <text x="240" y="40" fontSize="11" fontFamily="var(--font-mono)" letterSpacing="0.08em" fill="var(--color-muted)">
        WHAT BREAKS IT
      </text>
      <text x="240" y="390" fontSize="11" fontFamily="var(--font-mono)" letterSpacing="0.08em" fill="var(--color-muted)">
        WHAT CONFIRMS IT
      </text>
    </svg>
  );
}
