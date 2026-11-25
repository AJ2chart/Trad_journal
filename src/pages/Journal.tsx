import { useMemo, useRef, useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { db, uid } from '../db';
import { computeStats, sortChrono, tradePnl, tradeR } from '../calc';
import { fmtDate, fmtMoney, fmtNum, fmtPct, fmtR, parseNum, pnlClass, today, useSettings } from '../format';
import type { Side, Trade } from '../types';
import { defaultsFor, useInstruments } from '../instruments';

const EMPTY = { symbol: '', qty: '', entry: '', exit: '', stop: '', setup: '' };

export default function Journal() {
  const settings = useSettings();
  const instruments = useInstruments();
  const navigate = useNavigate();
  const trades = useLiveQuery(() => db.trades.toArray(), []) ?? [];
  const imageTradeIds = useLiveQuery(async () => new Set(await db.images.orderBy('tradeId').uniqueKeys()), []);
  const lessonTradeIds = useLiveQuery(async () => new Set(await db.lessons.orderBy('tradeIds').uniqueKeys()), []);

  const [date, setDate] = useState(today());
  const [side, setSide] = useState<Side>('long');
  const [f, setF] = useState(EMPTY);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const symbolRef = useRef<HTMLInputElement>(null);

  const setups = useMemo(
    () => [...new Set(trades.map((t) => t.setup?.trim()).filter(Boolean) as string[])].sort(),
    [trades],
  );
  const symbols = useMemo(() => [...new Set(trades.map((t) => t.symbol))].sort(), [trades]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? trades.filter((t) =>
          [t.symbol, t.setup, t.date, ...(t.mistakes ?? []), ...(t.emotions ?? [])]
            .filter(Boolean)
            .some((s) => s!.toLowerCase().includes(q)),
        )
      : trades;
    return sortChrono(list).reverse();
  }, [trades, query]);

  const summary = useMemo(() => computeStats(filtered), [filtered]);
  const symbolDefaults = f.symbol.trim() ? defaultsFor(f.symbol, instruments, settings) : null;
  const allSymbols = useMemo(() => [...new Set([...symbols, ...Object.keys(instruments)])].sort(), [symbols, instruments]);

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  async function add(e: FormEvent) {
    e.preventDefault();
    const qty = parseNum(f.qty);
    const entry = parseNum(f.entry);
    if (!f.symbol.trim()) return setError('Symbole manquant');
    if (qty == null || qty <= 0) return setError('Quantité invalide');
    if (entry == null) return setError('Prix d’entrée invalide');
    const d = defaultsFor(f.symbol, instruments, settings);
    const now = Date.now();
    const trade: Trade = {
      id: uid(),
      date,
      symbol: f.symbol.trim().toUpperCase(),
      side,
      qty,
      entry,
      exit: parseNum(f.exit),
      stop: parseNum(f.stop),
      setup: f.setup.trim() || undefined,
      fees: d.fees || undefined,
      feePct: d.feePct || undefined,
      multiplier: d.multiplier !== 1 ? d.multiplier : undefined,
      createdAt: now,
      updatedAt: now,
    };
    setError('');
    setF((p) => ({ ...EMPTY, setup: p.setup }));
    symbolRef.current?.focus();
    await db.trades.add(trade);
  }

  return (
    <div className="page">
      <form className="quick card" onSubmit={add} aria-label="Ajout rapide d’un trade">
        <div className="quick-grid">
          <label className="q-date">
            <span>Date</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </label>
          <label className="q-symbol">
            <span>Symbole</span>
            <input ref={symbolRef} value={f.symbol} onChange={set('symbol')} placeholder="BTCUSDT, ES…" list="symbols" autoCapitalize="characters" autoComplete="off" />
          </label>
          <div className="q-side">
            <span>Sens</span>
            <button
              type="button"
              className={`side-toggle ${side}`}
              onClick={() => setSide((s) => (s === 'long' ? 'short' : 'long'))}
              aria-label={`Sens : ${side}. Cliquer pour changer`}
            >
              {side === 'long' ? '▲ Long' : '▼ Short'}
            </button>
          </div>
          <label className="q-qty">
            <span>Qté</span>
            <input value={f.qty} onChange={set('qty')} inputMode="decimal" placeholder="1" />
          </label>
          <label className="q-entry">
            <span>Entrée</span>
            <input value={f.entry} onChange={set('entry')} inputMode="decimal" placeholder="prix" />
          </label>
          <label className="q-exit">
            <span>Sortie</span>
            <input value={f.exit} onChange={set('exit')} inputMode="decimal" placeholder="ouvert" />
          </label>
          <label className="q-stop">
            <span>Stop</span>
            <input value={f.stop} onChange={set('stop')} inputMode="decimal" placeholder="optionnel" />
          </label>
          <label className="q-setup">
            <span>Setup</span>
            <input value={f.setup} onChange={set('setup')} list="setups" placeholder="Breakout…" autoComplete="off" />
          </label>
          <button type="submit" className="btn primary q-add">Ajouter ↵</button>
        </div>
        {error && <p className="error">{error}</p>}
        {symbolDefaults && (symbolDefaults.known || symbolDefaults.multiplier !== 1 || symbolDefaults.fees > 0 || symbolDefaults.feePct > 0) && (
          <p className="quick-hint">
            {symbolDefaults.label ? `${symbolDefaults.label} · ` : ''}
            Valeur du point ×{String(symbolDefaults.multiplier).replace('.', ',')}
            {symbolDefaults.fees > 0 && ` · frais ${String(symbolDefaults.fees).replace('.', ',')} ${settings.currency}`}
            {symbolDefaults.feePct > 0 && ` · frais ${String(symbolDefaults.feePct).replace('.', ',')} %`}
          </p>
        )}
        <datalist id="setups">{setups.map((s) => <option key={s} value={s} />)}</datalist>
        <datalist id="symbols">{allSymbols.map((s) => <option key={s} value={s} />)}</datalist>
      </form>

      <div className="toolbar">
        <input className="search" type="search" placeholder="Filtrer (symbole, setup, erreur…)" value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="summary">
          <span>{summary.total} trades</span>
          <span>Réussite {fmtPct(summary.winRate)}</span>
          <strong className={pnlClass(summary.netPnl)}>{fmtMoney(summary.netPnl, settings.currency)}</strong>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty card">
          <p><strong>{trades.length ? 'Aucun trade ne correspond au filtre.' : 'Aucun trade pour l’instant.'}</strong></p>
          {!trades.length && <p>Remplis la ligne ci-dessus et appuie sur Entrée. Clique ensuite sur un trade pour ajouter capture, raisons et leçons.</p>}
        </div>
      ) : (
        <div className="trade-table" role="table">
          <div className="tr th" role="row">
            <span>Date</span><span>Symbole</span><span>Sens</span><span className="num">Qté</span>
            <span className="num">Entrée</span><span className="num">Sortie</span><span className="num">P&amp;L</span>
            <span className="num">R</span><span>Setup</span><span />
          </div>
          {filtered.map((t) => {
            const pnl = tradePnl(t);
            return (
              <div key={t.id} className="tr" role="row" tabIndex={0}
                onClick={() => navigate(`/trade/${t.id}`)}
                onKeyDown={(e) => e.key === 'Enter' && navigate(`/trade/${t.id}`)}>
                <span className="c-date" data-meta={` · ${t.side === 'long' ? 'Long' : 'Short'}${t.exit == null ? ' · ouvert' : ''}${t.setup ? ` · ${t.setup}` : ''}`}>{fmtDate(t.date)}</span>
                <span className="c-symbol">{t.symbol}</span>
                <span className={`c-side side-${t.side}`}>{t.side === 'long' ? '▲ Long' : '▼ Short'}</span>
                <span className="num c-qty">{fmtNum(t.qty)}</span>
                <span className="num c-entry">{fmtNum(t.entry)}</span>
                <span className="num c-exit">{t.exit == null ? <em className="open">ouvert</em> : fmtNum(t.exit)}</span>
                <span className={`num c-pnl ${pnlClass(pnl)}`}>{pnl == null ? '—' : fmtMoney(pnl, settings.currency)}</span>
                <span className="num c-r">{fmtR(tradeR(t))}</span>
                <span className="c-setup">{t.setup ?? ''}</span>
                <span className="c-flags">
                  {imageTradeIds?.has(t.id) && <span title="Capture">📷</span>}
                  {lessonTradeIds?.has(t.id) && <span title="Leçon liée">💡</span>}
                  {t.reasonEntry && <span title="Raison notée">✎</span>}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
