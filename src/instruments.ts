import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import type { Settings } from './types';

/** Paramètres retenus pour un symbole. */
export interface Instrument {
  /** Valeur d'un point pour 1 contrat / 1 unité */
  multiplier: number;
  fees?: number;
  feePct?: number;
  /** Libellé indicatif (ex. "E-mini S&P 500") */
  label?: string;
  /** Catégorie choisie par l'utilisateur (sinon devinée) */
  category?: import('./catalog').Category;
}

export type Instruments = Record<string, Instrument>;

/** Futures courants : valeur d'un point, dans la devise du contrat. */
export const FUTURES_PRESETS: { symbol: string; label: string; multiplier: number; currency: string }[] = [
  { symbol: 'ES', label: 'E-mini S&P 500', multiplier: 50, currency: '$' },
  { symbol: 'MES', label: 'Micro E-mini S&P 500', multiplier: 5, currency: '$' },
  { symbol: 'NQ', label: 'E-mini Nasdaq 100', multiplier: 20, currency: '$' },
  { symbol: 'MNQ', label: 'Micro E-mini Nasdaq 100', multiplier: 2, currency: '$' },
  { symbol: 'YM', label: 'E-mini Dow', multiplier: 5, currency: '$' },
  { symbol: 'MYM', label: 'Micro E-mini Dow', multiplier: 0.5, currency: '$' },
  { symbol: 'RTY', label: 'E-mini Russell 2000', multiplier: 50, currency: '$' },
  { symbol: 'M2K', label: 'Micro E-mini Russell 2000', multiplier: 5, currency: '$' },
  { symbol: 'FDAX', label: 'DAX (contrat standard)', multiplier: 25, currency: '€' },
  { symbol: 'FDXM', label: 'Mini-DAX', multiplier: 5, currency: '€' },
  { symbol: 'FDXS', label: 'Micro-DAX', multiplier: 1, currency: '€' },
  { symbol: 'FESX', label: 'Euro Stoxx 50', multiplier: 10, currency: '€' },
  { symbol: 'FCE', label: 'CAC 40', multiplier: 10, currency: '€' },
  { symbol: 'CL', label: 'Pétrole WTI', multiplier: 1000, currency: '$' },
  { symbol: 'MCL', label: 'Micro pétrole WTI', multiplier: 100, currency: '$' },
  { symbol: 'GC', label: 'Or', multiplier: 100, currency: '$' },
  { symbol: 'MGC', label: 'Micro or', multiplier: 10, currency: '$' },
];

export async function getInstruments(): Promise<Instruments> {
  return ((await db.kv.get('instruments'))?.value as Instruments) ?? {};
}

export async function saveInstrument(symbol: string, patch: Partial<Instrument>) {
  const key = symbol.trim().toUpperCase();
  if (!key) return;
  const all = await getInstruments();
  const next = { ...all[key], ...patch } as Instrument;
  if (!(next.multiplier > 0)) next.multiplier = 1;
  await db.kv.put({ key: 'instruments', value: { ...all, [key]: next } });
}

export async function deleteInstrument(symbol: string) {
  const all = await getInstruments();
  delete all[symbol];
  await db.kv.put({ key: 'instruments', value: all });
}

export function useInstruments(): Instruments {
  return (useLiveQuery(() => db.kv.get('instruments'), [])?.value as Instruments) ?? {};
}

/** Valeurs à appliquer à un nouveau trade : le symbole d'abord, puis les réglages par défaut. */
export function defaultsFor(symbol: string, instruments: Instruments, s: Settings) {
  const inst = instruments[symbol.trim().toUpperCase()];
  return {
    multiplier: inst?.multiplier ?? s.defaultMultiplier,
    fees: inst?.fees ?? s.defaultFees,
    feePct: inst?.feePct ?? s.defaultFeePct,
    known: !!inst,
    label: inst?.label,
  };
}
