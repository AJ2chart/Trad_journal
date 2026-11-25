import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { db } from '../db';
import { computeStats, type Group } from '../calc';
import { fmtDate, fmtMoney, fmtPct, fmtR, pnlClass, today, useSettings } from '../format';
import { EquityChart, PnlBars } from '../components/Charts';
import Calendar from '../components/Calendar';
import Icon, { type IconName } from '../components/Icon';
import { CountUp, Ring } from '../components/ui';
import { categoryLabel, categoryOf } from '../catalog';
import { useInstruments } from '../instruments';

const PERIODS = [
  { id: 'all', label: 'Tout' },
  { id: 'month', label: 'Ce mois' },
  { id: '30', label: '30 j' },
  { id: '90', label: '90 j' },
  { id: 'year', label: 'Cette année' },
] as const;
type Period = (typeof PERIODS)[number]['id'];

function since(p: Period): string | null {
  const t = today();
  if (p === 'all') return null;
  if (p === 'month') return t.slice(0, 8) + '01';
  if (p === 'year') return t.slice(0, 5) + '01-01';
  const d = new Date();
  d.setDate(d.getDate() - Number(p));
  return d.toISOString().slice(0, 10);
}

const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

export default function Stats() {
  const { currency } = useSettings();
  const trades = useLiveQuery(() => db.trades.toArray(), []);
  const instruments = useInstruments();
  const [period, setPeriod] = useState<Period>('all');
  const [side, setSide] = useState<'all' | 'long' | 'short'>('all');

  const s = useMemo(() => {
    const from = since(period);
    return computeStats((trades ?? []).filter((t) => (!from || t.date >= from) && (side === 'all' || t.side === side)), (t) => categoryLabel(categoryOf(t.symbol, instruments)));
  }, [trades, period, side, instruments]);

  const money = (v: number) => fmtMoney(v, currency);
  if (!trades) return null;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <span className="eyebrow">Statistiques</span>
          <h1>Ce que disent <span className="grad-text">tes chiffres.</span></h1>
        </div>
      </header>
      <div className="filters">
        <div className="seg">
          {PERIODS.map((p) => <button key={p.id} className={period === p.id ? 'on' : ''} onClick={() => setPeriod(p.id)}>{p.label}</button>)}
        </div>
        <div className="seg">
          {(['all', 'long', 'short'] as const).map((v) => <button key={v} className={side === v ? 'on' : ''} onClick={() => setSide(v)}>{v === 'all' ? 'Long + Short' : v === 'long' ? 'Long' : 'Short'}</button>)}
        </div>
      </div>

      {s.closed === 0 ? (
        <div className="empty-state glass"><div className="empty-ico"><Icon name="stats" size={28} /></div><h2>Pas encore de trade clôturé</h2><p className="muted">Les statistiques apparaissent dès qu’un trade a un prix de sortie sur cette période.</p></div>
      ) : (
        <>
          <section className="stats-hero glass">
            <div className="sh-main">
              <span className="eyebrow">P&amp;L net</span>
              <strong className={`sh-pnl mono ${pnlClass(s.netPnl)}`}><CountUp value={s.netPnl} format={money} /></strong>
              <span className="muted small">{s.closed} trades clôturés{s.open ? ` · ${s.open} ouverts` : ''}</span>
            </div>
            <div className="sh-ring">
              <Ring value={s.winRate} size={104} label={<><strong className="mono">{Math.round(s.winRate * 100)}%</strong><span>réussite</span></>} />
              <div className="sh-split">
                <span><i className="dot gain" />{s.wins} gagnants</span>
                <span><i className="dot loss" />{s.losses} perdants</span>
                {s.breakeven > 0 && <span><i className="dot" />{s.breakeven} nuls</span>}
              </div>
            </div>
          </section>

          <div className="kpis">
            <Kpi icon="zap" label="Profit factor" value={s.profitFactor == null ? '—' : s.profitFactor === Infinity ? '∞' : s.profitFactor.toFixed(2).replace('.', ',')} sub="gains bruts / pertes brutes" />
            <Kpi icon="target" label="Espérance par trade" value={money(s.expectancy)} cls={pnlClass(s.expectancy)} sub={s.avgR == null ? 'renseigne le stop pour le R' : `R moyen ${fmtR(s.avgR)} (${s.rCount} trades)`} />
            <Kpi icon="sparkle" label="Gain moyen / perte moyenne" value={s.payoff == null ? '—' : s.payoff.toFixed(2).replace('.', ',')} sub={`${money(s.avgWin)} / ${money(s.avgLoss)}`} />
            <Kpi icon="shield" label="Drawdown max" value={s.maxDrawdown ? money(-s.maxDrawdown) : '0'} cls={s.maxDrawdown ? 'loss' : ''} sub={`Séries max : ${s.maxWinStreak} gagnants · ${s.maxLossStreak} perdants`} />
          </div>

          <section className="card">
            <h2><Icon name="stats" size={17} /> P&amp;L cumulé</h2>
            <EquityChart format={money} points={s.equity.map((e) => ({
              label: fmtDate(e.trade.date),
              value: e.cum,
              detail: <span>{e.trade.symbol} : {money(e.pnl)}</span>,
            }))} />
          </section>

          <div className="two-col">
            <section className="card">
              <h2><Icon name="calendar" size={17} /> Calendrier</h2>
              <Calendar trades={(trades ?? []).filter((t) => side === 'all' || t.side === side)} money={money} />
            </section>
            <section className="card">
              <h2>P&amp;L par mois</h2>
              <PnlBars height={300} format={money} points={s.byMonth.map((g) => ({
                label: `${MONTHS[Number(g.key.slice(5)) - 1]} ${g.key.slice(2, 4)}`,
                value: g.pnl,
                detail: <span>{g.count} trades · {fmtPct(g.winRate)}</span>,
              }))} />
            </section>
          </div>

          <div className="two-col">
            <section className="card">
              <h2><Icon name="flame" size={17} /> Extrêmes</h2>
              <ul className="extremes">
                {s.best && <li><span className="muted">Meilleur trade</span><Link to={`/trade/${s.best.trade.id}`}>{s.best.trade.symbol} · {fmtDate(s.best.trade.date)}</Link><strong className={pnlClass(s.best.pnl)}>{money(s.best.pnl)}</strong></li>}
                {s.worst && <li><span className="muted">Pire trade</span><Link to={`/trade/${s.worst.trade.id}`}>{s.worst.trade.symbol} · {fmtDate(s.worst.trade.date)}</Link><strong className={pnlClass(s.worst.pnl)}>{money(s.worst.pnl)}</strong></li>}
                <li><span className="muted">Gains bruts</span><span /><strong>{money(s.grossWin)}</strong></li>
                <li><span className="muted">Pertes brutes</span><span /><strong>{money(s.grossLoss)}</strong></li>
                <li><span className="muted">Frais payés</span><span /><strong>{fmtMoney(s.totalFees, currency, false)}</strong></li>
              </ul>
            </section>
            <Breakdown title="Par catégorie" rows={s.byCategory} money={money} />
            <Breakdown title="Par setup" rows={s.bySetup} money={money} />
            <Breakdown title="Par erreur" rows={s.byMistake} money={money} hint="Ce que te coûtent tes erreurs" />
            <Breakdown title="Par symbole" rows={s.bySymbol} money={money} />
            <Breakdown title="Par émotion" rows={s.byEmotion} money={money} />
            <Breakdown title="Plan respecté" rows={s.byPlan} money={money} />
            <Breakdown title="Par jour de la semaine" rows={s.byWeekday} money={money} />
            <Breakdown title="Long / Short" rows={s.bySide} money={money} />
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, sub, cls = '', icon }: { label: string; value: string; sub?: string; cls?: string; icon?: IconName }) {
  return (
    <div className="kpi card">
      <span className="kpi-label">{icon && <Icon name={icon} size={14} />}{label}</span>
      <strong className={`kpi-value ${cls}`}>{value}</strong>
      {sub && <span className="kpi-sub">{sub}</span>}
    </div>
  );
}

function Breakdown({ title, rows, money, hint }: { title: string; rows: Group[]; money: (v: number) => string; hint?: string }) {
  const max = Math.max(1e-9, ...rows.map((r) => Math.abs(r.pnl)));
  return (
    <section className="card">
      <h2>{title}</h2>
      {hint && <p className="muted small">{hint}</p>}
      {rows.length === 0 ? <p className="muted small">Pas encore de donnée : renseigne-le dans le détail des trades.</p> : (
        <table className="breakdown">
          <thead><tr><th /><th className="num">Trades</th><th className="num">Réussite</th><th className="bar-col">P&amp;L</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <td>{r.key}</td>
                <td className="num">{r.count}</td>
                <td className="num">{fmtPct(r.winRate)}</td>
                <td className="bar-col">
                  <div className="hbar" title={`Moyenne : ${money(r.avg)}`}>
                    <div className="hbar-track">
                      <span className={r.pnl >= 0 ? 'hbar-fill gain' : 'hbar-fill loss'} style={{ width: `${(Math.abs(r.pnl) / max) * 100}%` }} />
                    </div>
                    <span className={`hbar-val ${pnlClass(r.pnl)}`}>{money(r.pnl)}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
