import { describe, expect, it } from 'vitest';
import { computeStats, tradePnl, tradeR } from './calc';
import type { Trade } from './types';

let n = 0;
const T = (p: Partial<Trade>): Trade => ({
  id: String(++n), date: '2026-01-0' + ((n % 9) + 1), symbol: 'X', side: 'long', qty: 1, entry: 100, exit: 110,
  createdAt: n, updatedAt: n, ...p,
});

describe('calculs', () => {
  it('P&L long, short, frais et valeur du point', () => {
    expect(tradePnl(T({ entry: 100, exit: 110, qty: 2 }))).toBe(20);
    expect(tradePnl(T({ side: 'short', entry: 100, exit: 90, qty: 2 }))).toBe(20);
    expect(tradePnl(T({ entry: 100, exit: 110, fees: 3 }))).toBe(7);
    expect(tradePnl(T({ entry: 15000, exit: 15010, multiplier: 5 }))).toBe(50);
    expect(tradePnl(T({ exit: null }))).toBeNull();
  });

  it('R multiple', () => {
    expect(tradeR(T({ entry: 100, exit: 120, stop: 90 }))).toBe(2);
    expect(tradeR(T({ side: 'short', entry: 100, exit: 105, stop: 105 }))).toBe(-1);
    expect(tradeR(T({ stop: null }))).toBeNull();
  });

  it('statistiques globales', () => {
    const s = computeStats([
      T({ date: '2026-01-01', exit: 110 }), // +10
      T({ date: '2026-01-02', exit: 95 }),  // -5
      T({ date: '2026-01-03', exit: 90 }),  // -10
      T({ date: '2026-01-04', exit: 130 }), // +30
      T({ date: '2026-01-05', exit: null }),
    ]);
    expect(s.closed).toBe(4);
    expect(s.open).toBe(1);
    expect(s.netPnl).toBe(25);
    expect(s.winRate).toBe(0.5);
    expect(s.profitFactor).toBeCloseTo(40 / 15);
    expect(s.maxDrawdown).toBe(15);
    expect(s.maxLossStreak).toBe(2);
    expect(s.equity.map((e) => e.cum)).toEqual([10, 5, -5, 25]);
  });
});
