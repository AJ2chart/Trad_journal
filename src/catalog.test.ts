import { describe, expect, it } from 'vitest';
import { categoryOf } from './catalog';

describe('catégories', () => {
  it('reconnaît les symboles courants', () => {
    expect(categoryOf('BTCUSDT')).toBe('crypto');
    expect(categoryOf('wifusdt')).toBe('crypto');
    expect(categoryOf('ETH/USD')).toBe('crypto');
    expect(categoryOf('MNQ')).toBe('futures');
    expect(categoryOf('MNQZ5')).toBe('futures');
    expect(categoryOf('GER40')).toBe('indices');
    expect(categoryOf('US100')).toBe('indices');
    expect(categoryOf('AAPL')).toBe('actions');
    expect(categoryOf('MC.PA')).toBe('actions');
  });
  it('le choix de l’utilisateur prime', () => {
    expect(categoryOf('XYZ', { XYZ: { multiplier: 1, category: 'indices' } })).toBe('indices');
  });
});
