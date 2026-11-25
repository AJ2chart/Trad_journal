import { FUTURES_PRESETS, type Instruments } from './instruments';

export type Category = 'crypto' | 'actions' | 'indices' | 'futures' | 'autre';

export const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'crypto', label: 'Crypto' },
  { id: 'actions', label: 'Actions' },
  { id: 'indices', label: 'Indices' },
  { id: 'futures', label: 'Futures' },
  { id: 'autre', label: 'Autre' },
];

export interface CatalogEntry { symbol: string; label: string; category: Category }

/** Symboles courants proposés d'office (les noms d'indices varient selon le broker). */
export const CATALOG: CatalogEntry[] = [
  ...([
    ['BTCUSDT', 'Bitcoin'], ['ETHUSDT', 'Ethereum'], ['SOLUSDT', 'Solana'], ['BNBUSDT', 'BNB'],
    ['XRPUSDT', 'XRP'], ['DOGEUSDT', 'Dogecoin'], ['ADAUSDT', 'Cardano'], ['AVAXUSDT', 'Avalanche'],
    ['LINKUSDT', 'Chainlink'], ['SUIUSDT', 'Sui'], ['TONUSDT', 'Toncoin'], ['PEPEUSDT', 'Pepe'],
  ] as const).map(([symbol, label]) => ({ symbol, label, category: 'crypto' as const })),
  ...([
    ['AAPL', 'Apple'], ['MSFT', 'Microsoft'], ['NVDA', 'Nvidia'], ['TSLA', 'Tesla'], ['AMZN', 'Amazon'],
    ['META', 'Meta'], ['GOOGL', 'Alphabet'], ['AMD', 'AMD'], ['NFLX', 'Netflix'], ['COIN', 'Coinbase'],
    ['MSTR', 'MicroStrategy'], ['MC.PA', 'LVMH'], ['TTE.PA', 'TotalEnergies'], ['AIR.PA', 'Airbus'],
  ] as const).map(([symbol, label]) => ({ symbol, label, category: 'actions' as const })),
  ...([
    ['US500', 'S&P 500'], ['US100', 'Nasdaq 100'], ['US30', 'Dow Jones'], ['US2000', 'Russell 2000'],
    ['GER40', 'DAX 40'], ['FRA40', 'CAC 40'], ['EU50', 'Euro Stoxx 50'], ['UK100', 'FTSE 100'], ['JP225', 'Nikkei 225'],
  ] as const).map(([symbol, label]) => ({ symbol, label, category: 'indices' as const })),
  ...FUTURES_PRESETS.map((p) => ({ symbol: p.symbol, label: p.label, category: 'futures' as const })),
];

const BY_SYMBOL = new Map(CATALOG.map((e) => [e.symbol, e]));

/** Catégorie d'un symbole : réglage de l'utilisateur, puis catalogue, puis devinette. */
export function categoryOf(symbol: string, instruments?: Instruments): Category {
  const s = symbol.trim().toUpperCase();
  const own = instruments?.[s]?.category;
  if (own) return own;
  const known = BY_SYMBOL.get(s);
  if (known) return known.category;
  if (/^[A-Z0-9]{2,12}[-/]?(USDT|USDC|BUSD|FDUSD|PERP)$/.test(s) || /^[A-Z]{2,6}[-/](USD|EUR|BTC)$/.test(s)) return 'crypto';
  if (/^(M?(ES|NQ|YM|RTY|CL|GC)|M2K|MYM|FDAX|FDXM|FDXS|FESX|FCE)[FGHJKMNQUVXZ]?\d{0,2}$/.test(s)) return 'futures';
  if (/^(US|GER|DE|FRA|FR|UK|EU|JP|HK|AUS|SPX|NAS|NDX)\d{2,4}$/.test(s)) return 'indices';
  if (/^[A-Z]{1,5}(\.[A-Z]{1,3})?$/.test(s)) return 'actions';
  return 'autre';
}

export function labelOf(symbol: string, instruments?: Instruments): string | undefined {
  const s = symbol.trim().toUpperCase();
  return instruments?.[s]?.label ?? BY_SYMBOL.get(s)?.label;
}

export const categoryLabel = (c: Category) => CATEGORIES.find((x) => x.id === c)?.label ?? 'Autre';
