import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Trade } from '../types';
import { tradePnl } from '../calc';
import Icon from './Icon';

const MONTH = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });
const WD = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const compact = new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1, signDisplay: 'exceptZero' });

/** Calendrier mensuel du P&L : bleu = jour gagnant, rouge = jour perdant, intensité = ampleur. */
export default function Calendar({ trades, money }: { trades: Trade[]; money: (v: number) => string }) {
  const navigate = useNavigate();
  const last = trades.reduce((m, t) => (t.date > m ? t.date : m), '');
  const [cursor, setCursor] = useState(() => (last || new Date().toISOString()).slice(0, 7));

  const byDay = useMemo(() => {
    const m = new Map<string, { pnl: number; n: number }>();
    for (const t of trades) {
      if (!t.date.startsWith(cursor)) continue;
      const p = tradePnl(t);
      const cur = m.get(t.date) ?? { pnl: 0, n: 0 };
      m.set(t.date, { pnl: cur.pnl + (p ?? 0), n: cur.n + 1 });
    }
    return m;
  }, [trades, cursor]);

  const [y, mo] = cursor.split('-').map(Number);
  const first = new Date(y, mo - 1, 1);
  const days = new Date(y, mo, 0).getDate();
  const offset = (first.getDay() + 6) % 7;
  const max = Math.max(1e-9, ...[...byDay.values()].map((d) => Math.abs(d.pnl)));
  const total = [...byDay.values()].reduce((s, d) => s + d.pnl, 0);
  const greenDays = [...byDay.values()].filter((d) => d.pnl > 0).length;
  const redDays = [...byDay.values()].filter((d) => d.pnl < 0).length;

  const shift = (k: number) => {
    const d = new Date(y, mo - 1 + k, 1);
    setCursor(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  return (
    <div className="cal">
      <div className="cal-head">
        <button className="icon-btn" onClick={() => shift(-1)} aria-label="Mois précédent"><Icon name="left" /></button>
        <div className="cal-title">
          <strong>{MONTH.format(first).replace(/^./, (c) => c.toUpperCase())}</strong>
          <span className="muted small">
            <span className={total > 0 ? 'gain' : total < 0 ? 'loss' : ''}>{money(total)}</span> · {greenDays} jour{greenDays > 1 ? 's' : ''} gagnant{greenDays > 1 ? 's' : ''} · {redDays} perdant{redDays > 1 ? 's' : ''}
          </span>
        </div>
        <button className="icon-btn" onClick={() => shift(1)} aria-label="Mois suivant"><Icon name="right" /></button>
      </div>
      <div className="cal-grid">
        {WD.map((d, i) => <span key={i} className="cal-wd">{d}</span>)}
        {Array.from({ length: offset }, (_, i) => <span key={'o' + i} />)}
        {Array.from({ length: days }, (_, i) => {
          const date = `${cursor}-${String(i + 1).padStart(2, '0')}`;
          const d = byDay.get(date);
          const a = d ? 0.18 + 0.62 * (Math.abs(d.pnl) / max) : 0;
          const cls = !d ? 'cal-day' : d.pnl > 0 ? 'cal-day win' : d.pnl < 0 ? 'cal-day lose' : 'cal-day flat';
          return (
            <button key={date} className={cls} style={d ? { ['--a' as string]: a } : undefined} disabled={!d}
              title={d ? `${date} : ${money(d.pnl)} (${d.n} trade${d.n > 1 ? 's' : ''})` : undefined}
              onClick={() => navigate(`/?q=${date}`)}>
              <span className="cal-num">{i + 1}</span>
              {d && <span className="cal-pnl mono">{compact.format(d.pnl)}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
