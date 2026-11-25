import type { Trade } from './types';

/** Frais totaux : fixes + % du montant échangé à l'entrée et à la sortie. */
export function tradeFees(t: Trade): number {
  const mult = t.multiplier ?? 1;
  const notional = (t.entry + (t.exit ?? 0)) * t.qty * mult;
  return (t.fees ?? 0) + (t.feePct ? (Math.abs(notional) * t.feePct) / 100 : 0);
}

export function tradePnl(t: Trade): number | null {
  if (t.exit == null || !isFinite(t.exit)) return null;
  const dir = t.side === 'long' ? 1 : -1;
  const mult = t.multiplier ?? 1;
  return (t.exit - t.entry) * t.qty * mult * dir - tradeFees(t);
}

/** Risque initial en devise (distance au stop × taille). */
export function tradeRisk(t: Trade): number | null {
  if (t.stop == null || !isFinite(t.stop)) return null;
  const risk = Math.abs(t.entry - t.stop) * t.qty * (t.multiplier ?? 1);
  return risk > 0 ? risk : null;
}

export function tradeR(t: Trade): number | null {
  const pnl = tradePnl(t);
  const risk = tradeRisk(t);
  if (pnl == null || risk == null) return null;
  return pnl / risk;
}

/** Ordre chronologique stable. */
export function sortChrono(trades: Trade[]): Trade[] {
  return [...trades].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.time ?? '').localeCompare(b.time ?? '') ||
      a.createdAt - b.createdAt,
  );
}

export interface Group {
  key: string;
  count: number;
  wins: number;
  pnl: number;
  winRate: number;
  avg: number;
}

export interface Stats {
  total: number;
  closed: number;
  open: number;
  wins: number;
  losses: number;
  breakeven: number;
  winRate: number;
  netPnl: number;
  grossWin: number;
  grossLoss: number;
  avgWin: number;
  avgLoss: number;
  /** avgWin / |avgLoss| */
  payoff: number | null;
  profitFactor: number | null;
  expectancy: number;
  avgR: number | null;
  rCount: number;
  totalFees: number;
  maxDrawdown: number;
  best: { trade: Trade; pnl: number } | null;
  worst: { trade: Trade; pnl: number } | null;
  maxWinStreak: number;
  maxLossStreak: number;
  equity: { trade: Trade; pnl: number; cum: number }[];
  bySetup: Group[];
  bySymbol: Group[];
  bySide: Group[];
  byWeekday: Group[];
  byMistake: Group[];
  byEmotion: Group[];
  byPlan: Group[];
  byMonth: Group[];
  byCategory: Group[];
}

const WEEKDAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

function groupBy(rows: { trade: Trade; pnl: number }[], keys: (t: Trade) => string[]): Group[] {
  const map = new Map<string, Group>();
  for (const r of rows) {
    for (const key of keys(r.trade)) {
      const g = map.get(key) ?? { key, count: 0, wins: 0, pnl: 0, winRate: 0, avg: 0 };
      g.count++;
      if (r.pnl > 0) g.wins++;
      g.pnl += r.pnl;
      map.set(key, g);
    }
  }
  return [...map.values()]
    .map((g) => ({ ...g, winRate: g.wins / g.count, avg: g.pnl / g.count }))
    .sort((a, b) => b.pnl - a.pnl);
}

export function computeStats(all: Trade[], categorize?: (t: Trade) => string): Stats {
  const sorted = sortChrono(all);
  const closed = sorted
    .map((trade) => ({ trade, pnl: tradePnl(trade) }))
    .filter((r): r is { trade: Trade; pnl: number } => r.pnl != null);

  const wins = closed.filter((r) => r.pnl > 0);
  const losses = closed.filter((r) => r.pnl < 0);
  const grossWin = wins.reduce((s, r) => s + r.pnl, 0);
  const grossLoss = losses.reduce((s, r) => s + r.pnl, 0);
  const netPnl = grossWin + grossLoss;

  let cum = 0;
  let peak = 0;
  let maxDrawdown = 0;
  let streakW = 0;
  let streakL = 0;
  let maxWinStreak = 0;
  let maxLossStreak = 0;
  const equity = closed.map((r) => {
    cum += r.pnl;
    peak = Math.max(peak, cum);
    maxDrawdown = Math.max(maxDrawdown, peak - cum);
    if (r.pnl > 0) {
      streakW++;
      streakL = 0;
    } else if (r.pnl < 0) {
      streakL++;
      streakW = 0;
    } else {
      streakW = 0;
      streakL = 0;
    }
    maxWinStreak = Math.max(maxWinStreak, streakW);
    maxLossStreak = Math.max(maxLossStreak, streakL);
    return { ...r, cum };
  });

  const rs = closed.map((r) => tradeR(r.trade)).filter((r): r is number => r != null);
  const avgWin = wins.length ? grossWin / wins.length : 0;
  const avgLoss = losses.length ? grossLoss / losses.length : 0;

  let best: Stats['best'] = null;
  let worst: Stats['worst'] = null;
  for (const r of closed) {
    if (!best || r.pnl > best.pnl) best = r;
    if (!worst || r.pnl < worst.pnl) worst = r;
  }

  return {
    total: all.length,
    closed: closed.length,
    open: all.length - closed.length,
    wins: wins.length,
    losses: losses.length,
    breakeven: closed.length - wins.length - losses.length,
    winRate: closed.length ? wins.length / closed.length : 0,
    netPnl,
    grossWin,
    grossLoss,
    avgWin,
    avgLoss,
    payoff: avgLoss ? avgWin / Math.abs(avgLoss) : null,
    profitFactor: grossLoss ? grossWin / Math.abs(grossLoss) : grossWin > 0 ? Infinity : null,
    expectancy: closed.length ? netPnl / closed.length : 0,
    avgR: rs.length ? rs.reduce((s, r) => s + r, 0) / rs.length : null,
    rCount: rs.length,
    totalFees: closed.reduce((s, r) => s + tradeFees(r.trade), 0),
    maxDrawdown,
    best,
    worst,
    maxWinStreak,
    maxLossStreak,
    equity,
    bySetup: groupBy(closed, (t) => [t.setup?.trim() || 'Sans setup']),
    bySymbol: groupBy(closed, (t) => [t.symbol.toUpperCase()]),
    bySide: groupBy(closed, (t) => [t.side === 'long' ? 'Long' : 'Short']),
    byWeekday: groupBy(closed, (t) => [WEEKDAYS[new Date(t.date + 'T12:00:00').getDay()]]),
    byMistake: groupBy(closed, (t) => (t.mistakes?.length ? t.mistakes : ['Aucune erreur'])),
    byEmotion: groupBy(closed, (t) => t.emotions ?? []),
    byPlan: groupBy(closed, (t) =>
      t.followedPlan == null ? [] : [t.followedPlan ? 'Plan respecté' : 'Plan non respecté'],
    ),
    byMonth: groupBy(closed, (t) => [t.date.slice(0, 7)]).sort((a, b) => a.key.localeCompare(b.key)),
    byCategory: categorize ? groupBy(closed, (t) => [categorize(t)]) : [],
  };
}
