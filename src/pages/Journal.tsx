import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { db } from '../db';
import { computeStats, sortChrono, tradePnl, tradeR } from '../calc';
import { fmtMoney, fmtNum, fmtPct, fmtR, pnlClass, today, useSettings } from '../format';
import type { Trade } from '../types';
import QuickAdd from '../components/QuickAdd';
import Icon from '../components/Icon';
import { CountUp, SidePill, Sparkline, SymbolBadge } from '../components/ui';
import { CATEGORIES, categoryOf, type Category } from '../catalog';
import { useInstruments } from '../instruments';

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dayLabel = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
const dayLabelYear = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

function prettyDay(d: string) {
  const t = today();
  const y = new Date(); y.setDate(y.getDate() - 1);
  if (d === t) return 'Aujourd’hui';
  if (d === iso(y)) return 'Hier';
  const date = new Date(d + 'T12:00:00');
  const s = (date.getFullYear() === new Date().getFullYear() ? dayLabel : dayLabelYear).format(date);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function sumPnl(list: Trade[]) {
  return list.reduce((s, t) => s + (tradePnl(t) ?? 0), 0);
}

export default function Journal() {
  const settings = useSettings();
  const money = (v: number) => fmtMoney(v, settings.currency);
  const navigate = useNavigate();
  const trades = useLiveQuery(() => db.trades.toArray(), []);
  const imageTradeIds = useLiveQuery(async () => new Set(await db.images.orderBy('tradeId').uniqueKeys()), []);
  const lessonTradeIds = useLiveQuery(async () => new Set(await db.lessons.orderBy('tradeIds').uniqueKeys()), []);
  const [params] = useSearchParams();
  const [query, setQuery] = useState(params.get('q') ?? '');
  const [cat, setCat] = useState<Category | 'all'>('all');
  const instruments = useInstruments();

  const all = trades ?? [];
  const periods = useMemo(() => {
    const t = today();
    const now = new Date();
    const monday = new Date(now); monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    const week = iso(monday);
    const month = t.slice(0, 8) + '01';
    const pick = (from: string) => all.filter((x) => x.date >= from);
    const todays = all.filter((x) => x.date === t);
    return {
      today: { pnl: sumPnl(todays), n: todays.length },
      week: { pnl: sumPnl(pick(week)), n: pick(week).length },
      month: { pnl: sumPnl(pick(month)), n: pick(month).length },
      total: computeStats(all),
    };
  }, [all]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = cat === 'all' ? all : all.filter((t) => categoryOf(t.symbol, instruments) === cat);
    if (q) list = list.filter((t) => [t.symbol, t.setup, t.date, ...(t.mistakes ?? []), ...(t.emotions ?? [])].filter(Boolean).some((s) => s!.toLowerCase().includes(q)));
    return sortChrono(list).reverse();
  }, [all, query, cat, instruments]);
  const presentCats = useMemo(() => {
    const counts = new Map<Category, number>();
    for (const t of all) { const c = categoryOf(t.symbol, instruments); counts.set(c, (counts.get(c) ?? 0) + 1); }
    return CATEGORIES.filter((c) => counts.has(c.id)).map((c) => ({ ...c, n: counts.get(c.id)! }));
  }, [all, instruments]);

  const groups = useMemo(() => {
    const m = new Map<string, Trade[]>();
    for (const t of filtered) m.set(t.date, [...(m.get(t.date) ?? []), t]);
    return [...m.entries()];
  }, [filtered]);

  const equity = periods.total.equity.map((e) => e.cum);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <span className="eyebrow">Journal</span>
          <h1>Tes trades, <span className="grad-text">au propre.</span></h1>
        </div>
      </header>

      <section className="tiles">
        <PeriodTile label="Aujourd’hui" pnl={periods.today.pnl} n={periods.today.n} money={money} accent />
        <PeriodTile label="Cette semaine" pnl={periods.week.pnl} n={periods.week.n} money={money} />
        <PeriodTile label="Ce mois" pnl={periods.month.pnl} n={periods.month.n} money={money} />
        <div className="tile tile-equity">
          <div className="tile-top">
            <span className="tile-label">Total</span>
            <span className="tile-chip">{fmtPct(periods.total.winRate)} réussite</span>
          </div>
          <strong className={`tile-value mono ${pnlClass(periods.total.netPnl)}`}><CountUp value={periods.total.netPnl} format={money} /></strong>
          <div className={`tile-spark ${pnlClass(periods.total.netPnl) || 'gain'}`}><Sparkline values={[0, ...equity]} width={220} height={36} /></div>
        </div>
      </section>

      <div className="quick-desktop"><QuickAdd /></div>

      <div className="toolbar">
        <label className="search">
          <Icon name="search" size={16} />
          <input type="search" placeholder="Rechercher : symbole, setup, erreur…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        {presentCats.length > 1 && (
          <div className="cat-filter" role="tablist" aria-label="Catégorie">
            <button role="tab" aria-selected={cat === 'all'} className={cat === 'all' ? 'on' : ''} onClick={() => setCat('all')}>Tout</button>
            {presentCats.map((c) => (
              <button key={c.id} role="tab" aria-selected={cat === c.id} className={cat === c.id ? 'on' : ''} onClick={() => setCat(c.id)}>
                {c.label}<span>{c.n}</span>
              </button>
            ))}
          </div>
        )}
        <span className="muted small toolbar-count">{filtered.length} trade{filtered.length > 1 ? 's' : ''}</span>
      </div>

      {trades && filtered.length === 0 ? (
        <div className="empty-state glass">
          <div className="empty-ico"><Icon name={all.length ? 'search' : 'sparkle'} size={28} /></div>
          <h2>{all.length ? 'Aucun trade ne correspond' : 'Ton journal commence ici'}</h2>
          <p className="muted">{all.length ? 'Essaie un autre filtre.' : 'Saisis ton premier trade en une ligne. Ensuite, ouvre-le pour ajouter la capture, ton raisonnement et tes leçons.'}</p>
        </div>
      ) : (
        <div className="days">
          {groups.map(([date, list]) => {
            const pnl = sumPnl(list);
            const closed = list.some((t) => t.exit != null);
            return (
              <section key={date} className="day">
                <header className="day-head">
                  <h2>{prettyDay(date)}</h2>
                  <span className="day-meta">
                    {list.length} trade{list.length > 1 ? 's' : ''}
                    {closed && <strong className={`mono ${pnlClass(pnl)}`}>{money(pnl)}</strong>}
                  </span>
                </header>
                <div className="rows glass">
                  {list.map((t, i) => {
                    const p = tradePnl(t);
                    const r = tradeR(t);
                    return (
                      <div key={t.id} className="trow" role="link" tabIndex={0} style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}
                        onClick={() => navigate(`/trade/${t.id}`)} onKeyDown={(e) => e.key === 'Enter' && navigate(`/trade/${t.id}`)}>
                        <SymbolBadge symbol={t.symbol} />
                        <div className="trow-main">
                          <strong>{t.symbol}</strong>
                          <span className="trow-sub">
                            {t.time && <>{t.time} · </>}{t.setup ?? <em>sans setup</em>}
                          </span>
                        </div>
                        <SidePill side={t.side} />
                        <div className="trow-prices mono">
                          <span>{fmtNum(t.entry)}</span>
                          <Icon name="right" size={12} />
                          {t.exit == null ? <span className="open-tag">ouvert</span> : <span>{fmtNum(t.exit)}</span>}
                          <span className="trow-qty">× {fmtNum(t.qty)}</span>
                        </div>
                        <div className="trow-flags">
                          {imageTradeIds?.has(t.id) && <Icon name="camera" size={15} />}
                          {lessonTradeIds?.has(t.id) && <Icon name="bulb" size={15} />}
                          {t.reasonEntry && <Icon name="pen" size={15} />}
                        </div>
                        <div className="trow-result">
                          <strong className={`mono ${pnlClass(p)}`}>{p == null ? '—' : money(p)}</strong>
                          {r != null && <span className={`r-chip ${pnlClass(r)}`}>{fmtR(r)}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PeriodTile({ label, pnl, n, money, accent }: { label: string; pnl: number; n: number; money: (v: number) => string; accent?: boolean }) {
  return (
    <div className={`tile ${accent ? 'tile-accent' : ''}`}>
      <div className="tile-top">
        <span className="tile-label">{label}</span>
        <span className="tile-chip">{n} trade{n > 1 ? 's' : ''}</span>
      </div>
      <strong className={`tile-value mono ${pnlClass(pnl)}`}><CountUp value={pnl} format={money} /></strong>
    </div>
  );
}
