import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon';

const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Nombre qui défile jusqu'à sa nouvelle valeur. */
export function CountUp({ value, format, duration = 700 }: { value: number; format: (v: number) => string; duration?: number }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    if (reduceMotion()) { setShown(value); from.current = value; return; }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const e = 1 - Math.pow(1 - p, 3);
      setShown(a + (value - a) * e);
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); from.current = value; };
  }, [value, duration]);
  return <>{format(shown)}</>;
}

/** Pastille de symbole : initiales sur une teinte stable dérivée du nom. */
export function SymbolBadge({ symbol, size = 36 }: { symbol: string; size?: number }) {
  let h = 0;
  for (const c of symbol) h = (h * 31 + c.charCodeAt(0)) % 360;
  const label = symbol.replace(/[^A-Z0-9]/gi, '').slice(0, symbol.length > 4 ? 3 : 4);
  return (
    <span className="sym-badge" style={{ width: size, height: size, ['--h' as string]: h, fontSize: size * (label.length > 3 ? 0.28 : 0.32) }}>
      {label}
    </span>
  );
}

export function SidePill({ side }: { side: 'long' | 'short' }) {
  return (
    <span className={`side-pill ${side}`}>
      <Icon name={side === 'long' ? 'up' : 'down'} size={12} stroke={2.4} />
      {side === 'long' ? 'Long' : 'Short'}
    </span>
  );
}

/** Mini-courbe sans axes, pour les tuiles. */
export function Sparkline({ values, width = 120, height = 36 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) return <svg width={width} height={height} />;
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * width, height - 3 - ((v - min) / span) * (height - 6)]);
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('');
  const up = values[values.length - 1] >= values[0];
  return (
    <svg className={`spark ${up ? 'up' : 'down'}`} width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={`sg-${up}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity=".35" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d}L${width},${height}L0,${height}Z`} fill={`url(#sg-${up})`} />
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2.6" fill="currentColor" />
    </svg>
  );
}

/** Anneau de progression (taux de réussite). */
export function Ring({ value, size = 92, label }: { value: number; size?: number; label: ReactNode }) {
  const r = size / 2 - 7;
  const c = 2 * Math.PI * r;
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} className="ring-track" />
        <circle cx={size / 2} cy={size / 2} r={r} className="ring-val"
          strokeDasharray={`${c * Math.max(0, Math.min(1, value))} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <span className="ring-label">{label}</span>
    </div>
  );
}

/* ---------- Notifications ---------- */

type ToastMsg = { id: number; text: string; to?: string; action?: string };
const listeners = new Set<(t: ToastMsg) => void>();
let nextId = 1;
export function toast(text: string, to?: string, action?: string) {
  const t = { id: nextId++, text, to, action };
  listeners.forEach((l) => l(t));
}

export function Toaster() {
  const [items, setItems] = useState<ToastMsg[]>([]);
  useEffect(() => {
    const l = (t: ToastMsg) => {
      setItems((p) => [...p.slice(-2), t]);
      setTimeout(() => setItems((p) => p.filter((x) => x.id !== t.id)), 3800);
    };
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return (
    <div className="toaster" role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className="toast">
          <Icon name="check" size={16} className="toast-ico" stroke={2.4} />
          <span>{t.text}</span>
          {t.to && <Link to={t.to} onClick={() => setItems((p) => p.filter((x) => x.id !== t.id))}>{t.action ?? 'Voir'} →</Link>}
        </div>
      ))}
    </div>
  );
}
