import { useMemo, useRef, useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, uid } from '../db';
import { parseNum, today, useSettings } from '../format';
import { defaultsFor, saveInstrument, useInstruments } from '../instruments';
import { categoryOf, categoryLabel } from '../catalog';
import type { Side, Trade } from '../types';
import Icon from './Icon';
import SymbolPicker from './SymbolPicker';
import { toast } from './ui';

const EMPTY = { symbol: '', qty: '', entry: '', exit: '', stop: '', setup: '' };
type Key = keyof typeof EMPTY;
/** Ordre de passage au champ suivant avec la touche « Suivant » du clavier mobile. */
const ORDER: Key[] = ['symbol', 'qty', 'entry', 'exit', 'stop', 'setup'];

export default function QuickAdd({ variant = 'bar', onDone, autoFocus }: { variant?: 'bar' | 'sheet'; onDone?: () => void; autoFocus?: boolean }) {
  const settings = useSettings();
  const instruments = useInstruments();
  const trades = useLiveQuery(() => db.trades.toArray(), []) ?? [];
  const [date, setDate] = useState(today());
  const [side, setSide] = useState<Side>('long');
  const [f, setF] = useState(EMPTY);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState(false);
  const refs = useRef<Partial<Record<Key, HTMLInputElement | null>>>({});
  const formRef = useRef<HTMLFormElement>(null);

  // Sur ordinateur, Entrée ajoute le trade depuis n'importe quel champ.
  // Dans la feuille mobile, Entrée (« Suivant ») passe au champ suivant ; le dernier valide.
  const stepMode = variant === 'sheet';

  const setups = useMemo(() => [...new Set(trades.map((t) => t.setup?.trim()).filter(Boolean) as string[])].sort(), [trades]);
  const d = f.symbol.trim() ? defaultsFor(f.symbol, instruments, settings) : null;
  const cat = f.symbol.trim() ? categoryOf(f.symbol, instruments) : null;

  const set = (k: Key) => (e: React.ChangeEvent<HTMLInputElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  const focusNext = (k: Key) => {
    const next = ORDER[ORDER.indexOf(k) + 1];
    if (next) refs.current[next]?.focus();
    else formRef.current?.requestSubmit();
  };
  const field = (k: Key) => ({
    ref: (el: HTMLInputElement | null) => { refs.current[k] = el; },
    value: f[k],
    onChange: set(k),
    enterKeyHint: (stepMode ? (k === 'setup' ? 'done' : 'next') : 'enter') as React.InputHTMLAttributes<HTMLInputElement>['enterKeyHint'],
    onKeyDown: stepMode ? (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') { e.preventDefault(); focusNext(k); }
    } : undefined,
  });

  async function add(e?: FormEvent) {
    e?.preventDefault();
    const qty = parseNum(f.qty);
    const entry = parseNum(f.entry);
    if (!f.symbol.trim()) { setError('Indique un symbole'); refs.current.symbol?.focus(); return; }
    if (qty == null || qty <= 0) { setError('Quantité invalide'); refs.current.qty?.focus(); return; }
    if (entry == null) { setError('Prix d’entrée invalide'); refs.current.entry?.focus(); return; }
    const symbol = f.symbol.trim().toUpperCase();
    const def = defaultsFor(symbol, instruments, settings);
    const now = Date.now();
    const trade: Trade = {
      id: uid(), date, symbol, side, qty, entry,
      exit: parseNum(f.exit), stop: parseNum(f.stop), setup: f.setup.trim() || undefined,
      fees: def.fees || undefined, feePct: def.feePct || undefined,
      multiplier: def.multiplier !== 1 ? def.multiplier : undefined,
      createdAt: now, updatedAt: now,
    };
    setError('');
    setF((p) => ({ ...EMPTY, setup: p.setup }));
    setFlash((v) => !v);
    // Le focus reste dans le même champ (pas de remontage) : le clavier ne se ferme pas.
    if (!stepMode) refs.current.symbol?.focus();
    await db.trades.add(trade);
    // Mémorise la catégorie devinée pour les symboles nouveaux.
    if (!instruments[symbol] && categoryOf(symbol) === 'futures') void saveInstrument(symbol, { category: 'futures' });
    toast(`${trade.symbol} ajouté`, `/trade/${trade.id}`, 'Détails');
    onDone?.();
  }

  return (
    <form ref={formRef} className={`quick quick-${variant}`} onSubmit={add} aria-label="Ajout rapide d’un trade">
      <div className="quick-head">
        <span className="quick-title"><Icon name="zap" size={15} /> Nouveau trade</span>
        <span className="kbd-hint"><kbd>↵</kbd> pour ajouter</span>
      </div>
      <div className={`quick-grid ${flash ? 'flash-a' : 'flash-b'}`}>
        <div className="qf q-symbol">
          <span>Symbole</span>
          <SymbolPicker
            ref={(el) => { refs.current.symbol = el; }}
            value={f.symbol}
            onChange={(v) => setF((p) => ({ ...p, symbol: v }))}
            onPick={() => refs.current.qty?.focus()}
            onEnter={stepMode ? () => focusNext('symbol') : () => formRef.current?.requestSubmit()}
            enterKeyHint={stepMode ? 'next' : 'enter'}
            placeholder="BTCUSDT"
            autoFocus={autoFocus}
          />
        </div>
        <div className="qf q-side">
          <span>Sens</span>
          <div className={`side-switch ${side}`} role="radiogroup" aria-label="Sens">
            <button type="button" role="radio" aria-checked={side === 'long'} onMouseDown={(e) => e.preventDefault()} onClick={() => setSide('long')}>Long</button>
            <button type="button" role="radio" aria-checked={side === 'short'} onMouseDown={(e) => e.preventDefault()} onClick={() => setSide('short')}>Short</button>
            <i aria-hidden />
          </div>
        </div>
        <label className="qf q-qty"><span>Qté</span><input {...field('qty')} inputMode="decimal" placeholder="1" autoComplete="off" /></label>
        <label className="qf q-entry"><span>Entrée</span><input {...field('entry')} inputMode="decimal" placeholder="prix" autoComplete="off" /></label>
        <label className="qf q-exit"><span>Sortie</span><input {...field('exit')} inputMode="decimal" placeholder="ouvert" autoComplete="off" /></label>
        <label className="qf q-stop"><span>Stop</span><input {...field('stop')} inputMode="decimal" placeholder="—" autoComplete="off" /></label>
        <label className="qf q-setup"><span>Setup</span><input {...field('setup')} list="qa-setups" placeholder="Breakout…" autoComplete="off" /></label>
        <label className="qf q-date"><span>Date</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></label>
        <button type="submit" className="btn primary q-add"><Icon name="plus" size={16} stroke={2.4} /> Ajouter</button>
      </div>
      {(error || (d && cat)) && (
        <p className={error ? 'quick-msg error' : 'quick-msg'}>
          {error || <>
            <em className="cat-tag">{categoryLabel(cat!)}</em>
            {d!.label ? `${d!.label} · ` : ''}point ×{String(d!.multiplier).replace('.', ',')}
            {d!.fees > 0 && ` · frais ${String(d!.fees).replace('.', ',')} ${settings.currency}`}
            {d!.feePct > 0 && ` · frais ${String(d!.feePct).replace('.', ',')} %`}
          </>}
        </p>
      )}
      <datalist id="qa-setups">{setups.map((s) => <option key={s} value={s} />)}</datalist>
    </form>
  );
}
