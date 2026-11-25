import { forwardRef, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { CATALOG, CATEGORIES, categoryOf, labelOf, type Category } from '../catalog';
import { useInstruments } from '../instruments';
import { SymbolBadge } from './ui';

interface Item { symbol: string; label?: string; category: Category; recent?: boolean }
type Tab = 'recent' | Category | 'all';

interface Props {
  value: string;
  onChange: (v: string) => void;
  /** Appelé quand un symbole est choisi dans la liste (pour passer au champ suivant). */
  onPick?: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  enterKeyHint?: React.InputHTMLAttributes<HTMLInputElement>['enterKeyHint'];
  onEnter?: () => void;
}

/** Champ symbole avec liste par catégorie (Récents, Crypto, Actions, Indices, Futures). */
const SymbolPicker = forwardRef<HTMLInputElement, Props>(function SymbolPicker(
  { value, onChange, onPick, placeholder, autoFocus, enterKeyHint, onEnter }, ref,
) {
  const instruments = useInstruments();
  const used = useLiveQuery(async () => {
    const all = await db.trades.orderBy('date').reverse().toArray();
    return [...new Set(all.map((t) => t.symbol))];
  }, []) ?? [];
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab | null>(null);
  const [hi, setHi] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const items = useMemo(() => {
    const map = new Map<string, Item>();
    used.forEach((s, i) => map.set(s, { symbol: s, label: labelOf(s, instruments), category: categoryOf(s, instruments), recent: i < 10 }));
    Object.keys(instruments).forEach((s) => !map.has(s) && map.set(s, { symbol: s, label: labelOf(s, instruments), category: categoryOf(s, instruments) }));
    CATALOG.forEach((e) => !map.has(e.symbol) && map.set(e.symbol, { symbol: e.symbol, label: e.label, category: categoryOf(e.symbol, instruments) }));
    return [...map.values()];
  }, [used, instruments]);

  const hasRecent = items.some((i) => i.recent);
  const activeTab: Tab = tab ?? (hasRecent ? 'recent' : 'all');
  const q = value.trim().toUpperCase();

  const shown = useMemo(() => {
    let list = items;
    if (q) {
      // En tapant, on cherche partout (symbole ou nom) et on garde l'onglet comme filtre doux.
      list = items.filter((i) => i.symbol.includes(q) || i.label?.toUpperCase().includes(q));
      if (activeTab !== 'all' && activeTab !== 'recent') {
        const inTab = list.filter((i) => i.category === activeTab);
        if (inTab.length) list = inTab;
      }
      return list.sort((a, b) => Number(b.symbol.startsWith(q)) - Number(a.symbol.startsWith(q)) || Number(!!b.recent) - Number(!!a.recent)).slice(0, 40);
    }
    if (activeTab === 'recent') return list.filter((i) => i.recent);
    if (activeTab === 'all') return list;
    return list.filter((i) => i.category === activeTab);
  }, [items, q, activeTab]);

  const exact = items.some((i) => i.symbol === q);
  const custom = q && !exact ? { symbol: q, category: categoryOf(q, instruments) } : null;
  // Le symbole tapé tel quel passe en dernier quand il y a des correspondances.
  const customItem = custom ? { ...custom, label: 'Nouveau symbole' } : null;
  const options: Item[] = customItem ? (shown.length ? [...shown, customItem] : [customItem]) : shown;

  const pick = (s: string) => {
    onChange(s);
    setOpen(false);
    onPick?.(s);
  };

  const tabs: { id: Tab; label: string }[] = [
    ...(hasRecent ? [{ id: 'recent' as Tab, label: 'Récents' }] : []),
    ...CATEGORIES.filter((c) => c.id !== 'autre' || items.some((i) => i.category === 'autre')).map((c) => ({ id: c.id as Tab, label: c.label })),
  ];

  return (
    <div className="sympick">
      <input
        ref={ref}
        value={value}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="characters"
        spellCheck={false}
        enterKeyHint={enterKeyHint}
        role="combobox"
        aria-expanded={open}
        aria-controls="sympick-list"
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onChange={(e) => { onChange(e.target.value.toUpperCase()); setOpen(true); setHi(0); }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setHi((h) => Math.min(h + 1, options.length - 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
          else if (e.key === 'Escape') setOpen(false);
          else if (e.key === 'Enter') {
            if (open && options[hi] && q && options[hi].symbol !== q) { e.preventDefault(); pick(options[hi].symbol); }
            else if (onEnter) { e.preventDefault(); setOpen(false); onEnter(); }
            else setOpen(false);
          }
        }}
      />
      {open && (
        // mousedown bloqué : le champ garde le focus, donc le clavier mobile reste ouvert.
        <div className="sympick-panel" onMouseDown={(e) => e.preventDefault()}>
          <div className="sympick-tabs" role="tablist">
            {tabs.map((t) => (
              <button key={t.id} type="button" role="tab" aria-selected={activeTab === t.id}
                className={activeTab === t.id ? 'on' : ''} onClick={() => { setTab(t.id); setHi(0); listRef.current?.scrollTo(0, 0); }}>
                {t.label}
              </button>
            ))}
          </div>
          <div className="sympick-list" id="sympick-list" role="listbox" ref={listRef}>
            {options.length === 0 && <p className="sympick-empty">Tape un symbole pour l’ajouter.</p>}
            {options.map((o, i) => (
              <button key={o.symbol + (o === customItem ? '-new' : '')} type="button" role="option" aria-selected={i === hi}
                className={`sympick-item ${i === hi ? 'hi' : ''}`} onMouseEnter={() => setHi(i)} onClick={() => pick(o.symbol)}>
                <SymbolBadge symbol={o.symbol} size={30} />
                <span className="sympick-name"><strong>{o.symbol}</strong>{o.label && <small>{o.label}</small>}</span>
                <span className="sympick-cat">{CATEGORIES.find((c) => c.id === o.category)?.label}</span>
                {instruments[o.symbol]?.multiplier && instruments[o.symbol].multiplier !== 1 && <span className="sympick-mult mono">×{String(instruments[o.symbol].multiplier).replace('.', ',')}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

export default SymbolPicker;
