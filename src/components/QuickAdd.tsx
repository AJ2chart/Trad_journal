import { useMemo, useRef, useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, uid } from '../db';
import { parseNum, today, useSettings } from '../format';
import { defaultsFor, useInstruments } from '../instruments';
import type { Side, Trade } from '../types';
import Icon from './Icon';
import { toast } from './ui';

const EMPTY = { symbol: '', qty: '', entry: '', exit: '', stop: '', setup: '' };

export default function QuickAdd({ variant = 'bar', onDone, autoFocus }: { variant?: 'bar' | 'sheet'; onDone?: () => void; autoFocus?: boolean }) {
  const settings = useSettings();
  const instruments = useInstruments();
  const trades = useLiveQuery(() => db.trades.toArray(), []) ?? [];
  const [date, setDate] = useState(today());
  const [side, setSide] = useState<Side>('long');
  const [f, setF] = useState(EMPTY);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState(0);
  const symbolRef = useRef<HTMLInputElement>(null);

  const setups = useMemo(() => [...new Set(trades.map((t) => t.setup?.trim()).filter(Boolean) as string[])].sort(), [trades]);
  const symbols = useMemo(() => [...new Set([...trades.map((t) => t.symbol), ...Object.keys(instruments)])].sort(), [trades, instruments]);
  const d = f.symbol.trim() ? defaultsFor(f.symbol, instruments, settings) : null;
  const showHint = d && (d.known || d.multiplier !== 1 || d.fees > 0 || d.feePct > 0);

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  async function add(e: FormEvent) {
    e.preventDefault();
    const qty = parseNum(f.qty);
    const entry = parseNum(f.entry);
    if (!f.symbol.trim()) return setError('Indique un symbole');
    if (qty == null || qty <= 0) return setError('Quantité invalide');
    if (entry == null) return setError('Prix d’entrée invalide');
    const def = defaultsFor(f.symbol, instruments, settings);
    const now = Date.now();
    const trade: Trade = {
      id: uid(), date, symbol: f.symbol.trim().toUpperCase(), side, qty, entry,
      exit: parseNum(f.exit), stop: parseNum(f.stop), setup: f.setup.trim() || undefined,
      fees: def.fees || undefined, feePct: def.feePct || undefined,
      multiplier: def.multiplier !== 1 ? def.multiplier : undefined,
      createdAt: now, updatedAt: now,
    };
    setError('');
    setF((p) => ({ ...EMPTY, setup: p.setup }));
    setFlash((n) => n + 1);
    symbolRef.current?.focus();
    await db.trades.add(trade);
    toast(`${trade.symbol} ajouté`, `/trade/${trade.id}`, 'Détails');
    onDone?.();
  }

  return (
    <form className={`quick quick-${variant}`} onSubmit={add} aria-label="Ajout rapide d’un trade">
      <div className="quick-head">
        <span className="quick-title"><Icon name="zap" size={15} /> Nouveau trade</span>
        <span className="kbd-hint"><kbd>↵</kbd> pour ajouter</span>
      </div>
      <div className="quick-grid" key={flash}>
        <label className="qf q-symbol">
          <span>Symbole</span>
          <input ref={symbolRef} value={f.symbol} onChange={set('symbol')} placeholder="BTCUSDT" list="qa-symbols"
            autoCapitalize="characters" autoComplete="off" autoFocus={autoFocus} />
        </label>
        <div className="qf q-side">
          <span>Sens</span>
          <div className={`side-switch ${side}`} role="radiogroup" aria-label="Sens">
            <button type="button" role="radio" aria-checked={side === 'long'} onClick={() => setSide('long')}>Long</button>
            <button type="button" role="radio" aria-checked={side === 'short'} onClick={() => setSide('short')}>Short</button>
            <i aria-hidden />
          </div>
        </div>
        <label className="qf q-qty"><span>Qté</span><input value={f.qty} onChange={set('qty')} inputMode="decimal" placeholder="1" /></label>
        <label className="qf q-entry"><span>Entrée</span><input value={f.entry} onChange={set('entry')} inputMode="decimal" placeholder="prix" /></label>
        <label className="qf q-exit"><span>Sortie</span><input value={f.exit} onChange={set('exit')} inputMode="decimal" placeholder="ouvert" /></label>
        <label className="qf q-stop"><span>Stop</span><input value={f.stop} onChange={set('stop')} inputMode="decimal" placeholder="—" /></label>
        <label className="qf q-setup"><span>Setup</span><input value={f.setup} onChange={set('setup')} list="qa-setups" placeholder="Breakout…" autoComplete="off" /></label>
        <label className="qf q-date"><span>Date</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></label>
        <button type="submit" className="btn primary q-add"><Icon name="plus" size={16} stroke={2.4} /> Ajouter</button>
      </div>
      {(error || showHint) && (
        <p className={error ? 'quick-msg error' : 'quick-msg'}>
          {error || <>
            {d!.label ? `${d!.label} · ` : ''}point ×{String(d!.multiplier).replace('.', ',')}
            {d!.fees > 0 && ` · frais ${String(d!.fees).replace('.', ',')} ${settings.currency}`}
            {d!.feePct > 0 && ` · frais ${String(d!.feePct).replace('.', ',')} %`}
          </>}
        </p>
      )}
      <datalist id="qa-setups">{setups.map((s) => <option key={s} value={s} />)}</datalist>
      <datalist id="qa-symbols">{symbols.map((s) => <option key={s} value={s} />)}</datalist>
    </form>
  );
}
