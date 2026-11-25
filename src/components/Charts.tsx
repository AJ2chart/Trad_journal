import { useEffect, useRef, useState, type ReactNode } from 'react';

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(600);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/** Graduations "rondes" pour l'axe Y. */
function ticks(min: number, max: number, n = 4): number[] {
  if (min === max) { min -= 1; max += 1; }
  const raw = (max - min) / n;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  const lo = Math.floor(min / step), hi = Math.ceil(max / step);
  for (let k = lo; k <= hi; k++) out.push(+(k * step).toFixed(10));
  return out;
}

const compact = new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 });

interface Tip { x: number; y: number; content: ReactNode }

function Tooltip({ tip, width }: { tip: Tip | null; width: number }) {
  if (!tip) return null;
  const left = Math.min(Math.max(tip.x, 70), width - 70);
  return <div className="chart-tip" style={{ left, top: tip.y }}>{tip.content}</div>;
}

export interface Point { label: string; value: number; detail?: ReactNode }

const PAD = { l: 52, r: 12, t: 12, b: 26 };

/** Courbe de capital : une seule série, crosshair + infobulle au survol. */
export function EquityChart({ points, height = 240, format }: { points: Point[]; height?: number; format: (v: number) => string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const values = [0, ...points.map((p) => p.value)];
  const yt = ticks(Math.min(...values), Math.max(...values));
  const y0 = yt[0], y1 = yt[yt.length - 1];
  const iw = width - PAD.l - PAD.r, ih = height - PAD.t - PAD.b;
  const n = points.length;
  const x = (i: number) => PAD.l + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v: number) => PAD.t + ih - ((v - y0) / (y1 - y0)) * ih;
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join('');
  const area = n ? `${line}L${x(n - 1)},${y(0)}L${x(0)},${y(0)}Z` : '';

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!n) return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left;
    setHover(Math.round(Math.min(Math.max((px - PAD.l) / iw, 0), 1) * (n - 1)));
  };
  const h = hover != null ? points[hover] : null;
  // Une étiquette d'axe X environ tous les 90 px.
  const every = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(iw / 90))));

  return (
    <div className="chart" ref={ref}>
      <svg width={width} height={height} onPointerMove={onMove} onPointerLeave={() => setHover(null)} role="img" aria-label="Courbe du P&L cumulé">
        {yt.map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={width - PAD.r} y1={y(v)} y2={y(v)} className={v === 0 ? 'axis-zero' : 'grid'} />
            <text x={PAD.l - 8} y={y(v)} className="tick" textAnchor="end" dominantBaseline="middle">{compact.format(v)}</text>
          </g>
        ))}
        {points.map((p, i) => i % every === 0 && (
          <text key={i} x={x(i)} y={height - 6} className="tick" textAnchor={x(i) > width - 40 ? 'end' : x(i) < PAD.l + 30 ? 'start' : 'middle'}>{p.label}</text>
        ))}
        <path d={area} className="equity-area" />
        <path d={line} className="equity-line" />
        {h && hover != null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={PAD.t + ih} className="crosshair" />
            <circle cx={x(hover)} cy={y(h.value)} r={5} className="equity-dot" />
          </g>
        )}
      </svg>
      <Tooltip width={width} tip={h && hover != null ? {
        x: x(hover), y: Math.max(0, y(h.value) - 64),
        content: <><strong>{format(h.value)}</strong><span>{h.label}</span>{h.detail}</>,
      } : null} />
    </div>
  );
}

/** Barres verticales autour de zéro : gain (bleu) / perte (rouge). */
export function PnlBars({ points, height = 220, format }: { points: Point[]; height?: number; format: (v: number) => string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const yt = ticks(Math.min(0, ...points.map((p) => p.value)), Math.max(0, ...points.map((p) => p.value)));
  const y0 = yt[0], y1 = yt[yt.length - 1];
  const iw = width - PAD.l - PAD.r, ih = height - PAD.t - PAD.b;
  const y = (v: number) => PAD.t + ih - ((v - y0) / (y1 - y0)) * ih;
  const slot = iw / Math.max(1, points.length);
  const bw = Math.max(4, Math.min(48, slot - 2));
  const every = Math.max(1, Math.ceil(points.length / Math.max(1, Math.floor(iw / 60))));

  return (
    <div className="chart" ref={ref}>
      <svg width={width} height={height} role="img" aria-label="P&L par période" onPointerLeave={() => setHover(null)}>
        {yt.map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={width - PAD.r} y1={y(v)} y2={y(v)} className={v === 0 ? 'axis-zero' : 'grid'} />
            <text x={PAD.l - 8} y={y(v)} className="tick" textAnchor="end" dominantBaseline="middle">{compact.format(v)}</text>
          </g>
        ))}
        {points.map((p, i) => {
          const cx = PAD.l + slot * i + slot / 2;
          const top = y(Math.max(0, p.value)), bottom = y(Math.min(0, p.value));
          const hgt = Math.max(1, bottom - top);
          const r = Math.min(4, bw / 2, hgt);
          const x0 = cx - bw / 2;
          // Coins arrondis uniquement côté valeur, ancrés à la ligne zéro.
          const d = p.value >= 0
            ? `M${x0},${bottom}V${top + r}Q${x0},${top} ${x0 + r},${top}H${x0 + bw - r}Q${x0 + bw},${top} ${x0 + bw},${top + r}V${bottom}Z`
            : `M${x0},${top}V${bottom - r}Q${x0},${bottom} ${x0 + r},${bottom}H${x0 + bw - r}Q${x0 + bw},${bottom} ${x0 + bw},${bottom - r}V${top}Z`;
          return (
            <g key={i} onPointerEnter={() => setHover(i)}>
              <rect x={PAD.l + slot * i} y={PAD.t} width={slot} height={ih} fill="transparent" />
              <path d={d} className={`bar ${p.value >= 0 ? 'bar-gain' : 'bar-loss'} ${hover === i ? 'hl' : ''}`} />
              {i % every === 0 && <text x={cx} y={height - 6} className="tick" textAnchor="middle">{p.label}</text>}
            </g>
          );
        })}
      </svg>
      <Tooltip width={width} tip={hover != null ? {
        x: PAD.l + slot * hover + slot / 2, y: Math.max(0, y(Math.max(0, points[hover].value)) - 64),
        content: <><strong>{format(points[hover].value)}</strong><span>{points[hover].label}</span>{points[hover].detail}</>,
      } : null} />
    </div>
  );
}
