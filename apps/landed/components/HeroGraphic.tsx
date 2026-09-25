// Illustration only (no data). One amber line splitting into 4 execution points along a time axis, over faint depth bands
// (taller band = thinner market). A single pulse travels the line. SVG + SMIL, hidden under reduced motion.
const POINTS = [
  { x: 250, label: "order 1" },
  { x: 330, label: "order 2" },
  { x: 430, label: "order 3" },
  { x: 520, label: "order 4" },
];
const BANDS = [
  { x: 40, w: 180, h: 120, label: "thin" },
  { x: 220, w: 150, h: 34, label: "liquid" },
  { x: 370, w: 40, h: 70, label: "" },
  { x: 410, w: 150, h: 30, label: "" },
  { x: 560, w: 60, h: 90, label: "" },
];
const BASE = 300;

export function HeroGraphic() {
  return (
    <svg viewBox="0 0 640 360" className="h-auto w-full" role="img" aria-label="One payday amount split into four orders placed in the most liquid hours">
      <defs>
        <path id="main-line" d={`M40 ${BASE - 150} C 120 ${BASE - 150}, 160 ${BASE - 140}, 200 ${BASE - 118}`} />
      </defs>
      {BANDS.map((b, i) => (
        <g key={i}>
          <rect x={b.x} y={BASE - b.h} width={b.w - 2} height={b.h} fill="var(--color-accent)" fillOpacity={0.04 + (b.h / 120) * 0.08} />
          {b.label ? (
            <text x={b.x + 6} y={BASE - b.h - 6} fontSize="10" fontFamily="var(--font-mono)" fill="var(--color-muted)">
              {b.label}
            </text>
          ) : null}
        </g>
      ))}
      <line x1="40" x2="620" y1={BASE} y2={BASE} stroke="var(--color-line-strong)" />
      {[40, 160, 280, 400, 520, 620].map((x) => (
        <line key={x} x1={x} x2={x} y1={BASE} y2={BASE + 6} stroke="var(--color-line-strong)" />
      ))}
      <text x="40" y={BASE + 24} fontSize="10" fontFamily="var(--font-mono)" fill="var(--color-muted)">
        alert
      </text>
      <text x="620" y={BASE + 24} textAnchor="end" fontSize="10" fontFamily="var(--font-mono)" fill="var(--color-muted)">
        time
      </text>

      {/* the amount arrives as one line, then splits */}
      <use href="#main-line" fill="none" stroke="var(--color-accent)" strokeWidth="2" />
      <circle cx="40" cy={BASE - 150} r="6" fill="var(--color-accent)" />
      <text x="40" y={BASE - 166} fontSize="11" fontFamily="var(--font-mono)" fill="var(--color-fg)">
        payday
      </text>
      {POINTS.map((p, i) => {
        const d = `M200 ${BASE - 118} C ${230 + i * 10} ${BASE - 100}, ${p.x - 40} ${BASE - 10}, ${p.x} ${BASE}`;
        return (
          <g key={p.label}>
            <path id={`split-${i}`} d={d} fill="none" stroke="var(--color-accent)" strokeOpacity="0.55" strokeWidth="1.3" />
            <circle cx={p.x} cy={BASE} r="5.5" fill="var(--color-accent)" stroke="var(--color-bg)" strokeWidth="2" />
            <text x={p.x} y={BASE + 40} textAnchor="middle" fontSize="10" fontFamily="var(--font-mono)" fill="var(--color-muted)">
              {p.label}
            </text>
            <circle r="2.5" fill="var(--color-fg)" opacity="0" className="hero-pulse">
              <animateMotion dur="6s" begin={`${i * 1.5}s`} repeatCount="indefinite" calcMode="linear">
                <mpath href={`#split-${i}`} />
              </animateMotion>
              <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.8;1" dur="6s" begin={`${i * 1.5}s`} repeatCount="indefinite" />
            </circle>
          </g>
        );
      })}
      {/* the naive alternative: everything at the alert */}
      <circle cx="40" cy={BASE} r="5" fill="var(--color-bg)" stroke="var(--color-muted)" strokeWidth="1.5" />
      <line x1="40" x2="40" y1={BASE - 144} y2={BASE - 6} stroke="var(--color-muted)" strokeDasharray="2 4" />
    </svg>
  );
}
