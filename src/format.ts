import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { DEFAULT_SETTINGS, type Settings } from './types';

const nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
const nfPrice = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 6 });

export const fmtMoney = (v: number, cur: string, signed = true) =>
  `${signed && v > 0 ? '+' : ''}${nf.format(v)} ${cur}`;
export const fmtNum = (v: number | null | undefined) => (v == null ? '—' : nfPrice.format(v));
export const fmtPct = (v: number) => `${(v * 100).toFixed(1).replace('.', ',')} %`;
export const fmtR = (v: number | null) => (v == null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(2).replace('.', ',')} R`);
export const fmtDate = (d: string) => {
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y.slice(2)}`;
};
export const pnlClass = (v: number | null | undefined) => (v == null ? '' : v > 0 ? 'gain' : v < 0 ? 'loss' : '');

export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Accepte "1,25" comme "1.25". Retourne null si vide/invalide. */
export const parseNum = (s: string): number | null => {
  const v = parseFloat(s.replace(/\s/g, '').replace(',', '.'));
  return isFinite(v) ? v : null;
};

export function useSettings(): Settings {
  const row = useLiveQuery(() => db.kv.get('settings'), []);
  return { ...DEFAULT_SETTINGS, ...((row?.value as Partial<Settings>) ?? {}) };
}
