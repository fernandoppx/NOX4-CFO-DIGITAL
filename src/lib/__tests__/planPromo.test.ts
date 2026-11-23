import { describe, it, expect, vi } from 'vitest';

vi.mock('../supabase', () => ({ supabase: {} }));

import { getActivePromo } from '../billingService';
import type { Plan } from '../../types';

const base: Plan = {
  id: 'p1',
  name: 'NOX4 Profissional Anual',
  max_organizations: 1,
  included_users: 5,
  extra_user_price: 29.9,
  base_price: 207.5,
  annual_price: 2490,
  billing_cycle: 'yearly',
  promo_label: 'Black Friday',
  promo_price: 1494,
  promo_cycles: 1,
  promo_starts_at: '2026-11-24T00:00:00-03:00',
  promo_ends_at: '2026-12-31T23:59:59-03:00',
};

describe('getActivePromo', () => {
  it('aplica a promoção do anual dentro do período', () => {
    const p = getActivePromo(base, new Date('2026-11-27T12:00:00-03:00'));
    expect(p).not.toBeNull();
    expect(p!.price).toBe(1494);
    expect(p!.regularPrice).toBe(2490);
    expect(p!.percentOff).toBe(40);
    expect(p!.cycles).toBe(1);
  });

  it('não aplica antes do início nem depois do fim', () => {
    expect(getActivePromo(base, new Date('2026-11-23T12:00:00-03:00'))).toBeNull();
    expect(getActivePromo(base, new Date('2027-01-01T00:00:01-03:00'))).toBeNull();
  });

  it('calcula 30% no mensal por 3 ciclos', () => {
    const monthly: Plan = { ...base, billing_cycle: 'monthly', base_price: 249, annual_price: undefined, promo_price: 174.3, promo_cycles: 3 };
    const p = getActivePromo(monthly, new Date('2026-12-10T12:00:00-03:00'));
    expect(p!.percentOff).toBe(30);
    expect(p!.cycles).toBe(3);
  });

  it('ignora promoção sem preço ou maior que o preço cheio', () => {
    expect(getActivePromo({ ...base, promo_price: null }, new Date('2026-12-01'))).toBeNull();
    expect(getActivePromo({ ...base, promo_price: 3000 }, new Date('2026-12-01'))).toBeNull();
  });
});
