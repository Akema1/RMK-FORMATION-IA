/**
 * Regression test for the global-view charges undercount bug.
 *
 * Background: FinancePage.calculateFinancials(view="global") aggregates per-seminar
 * plans via reduce, but upstream special-cased `billet_avion` and `transport` to
 * `semPlans[0]?.charges.X || 0` — taking only the first seminar's value instead of
 * summing across all. This caused the global-view charges breakdown to not reconcile
 * with the global `totalCharges` (which IS summed correctly on line 462).
 *
 * Flagged by both Gemini and Qwen code reviews on the Phase 2 session diff.
 *
 * This test pins the aggregation helper's behavior so that any future regression
 * (or re-port from upstream) fails loudly.
 */
import { describe, it, expect } from 'vitest';
import { aggregatePlanGlobally } from '../src/admin/finance/aggregatePlanGlobally';
import type { FinancialResult } from '../src/admin/types';

const makePlan = (overrides: Partial<FinancialResult['charges']> = {}): FinancialResult => {
  const charges: FinancialResult['charges'] = {
    consultance_pres: 500_000,
    consultance_ligne: 0,
    billet_avion: 800_000,
    sejour: 400_000,
    salle: 300_000,
    pauses_cafe: 50_000,
    dejeuner: 200_000,
    supports: 100_000,
    equipements: 150_000,
    divers: 50_000,
    transport: 120_000,
    commercialisation: 175_000,
    ...overrides,
  };
  // Keep the fixture internally consistent: totalCharges must equal the sum
  // of the charges breakdown. This is the same invariant the global-view
  // bug violated, so the fixture itself must uphold it or the reconciliation
  // test becomes meaningless.
  const totalCharges = Object.values(charges).reduce((a, b) => a + b, 0);
  const totalRevenus = 3_500_000;
  const revenuProv = totalRevenus - totalCharges;
  const imprevu = revenuProv > 0 ? revenuProv * 0.1 : 0;
  const sousTotalBrut = revenuProv - imprevu;
  const tva = sousTotalBrut > 0 ? sousTotalBrut * 0.18 : 0;
  const net = sousTotalBrut - tva;
  return {
    qtyStandard: 10,
    qtyEarlyBird: 5,
    totalPax: 15,
    revStandard: 2_500_000,
    revEarlyBird: 1_000_000,
    totalRevenus,
    charges,
    totalCharges,
    revenuProv,
    imprevu,
    sousTotalBrut,
    tva,
    net,
  };
};

describe('aggregatePlanGlobally', () => {
  it('sums billet_avion across all seminars (regression: not just semPlans[0])', () => {
    const semPlans = [
      makePlan({ billet_avion: 800_000 }),
      makePlan({ billet_avion: 600_000 }),
      makePlan({ billet_avion: 500_000 }),
    ];
    const global = aggregatePlanGlobally(semPlans);
    expect(global.charges.billet_avion).toBe(1_900_000);
  });

  it('sums transport across all seminars (regression: not just semPlans[0])', () => {
    const semPlans = [
      makePlan({ transport: 120_000 }),
      makePlan({ transport: 150_000 }),
      makePlan({ transport: 90_000 }),
    ];
    const global = aggregatePlanGlobally(semPlans);
    expect(global.charges.transport).toBe(360_000);
  });

  it('sums every other charges field symmetrically', () => {
    const semPlans = [
      makePlan({ consultance_pres: 500_000, sejour: 400_000, salle: 300_000 }),
      makePlan({ consultance_pres: 600_000, sejour: 500_000, salle: 350_000 }),
    ];
    const global = aggregatePlanGlobally(semPlans);
    expect(global.charges.consultance_pres).toBe(1_100_000);
    expect(global.charges.sejour).toBe(900_000);
    expect(global.charges.salle).toBe(650_000);
  });

  it('sums top-level P&L fields (totalRevenus, totalCharges, net)', () => {
    const one = makePlan();
    const semPlans = [makePlan(), makePlan(), makePlan()];
    const global = aggregatePlanGlobally(semPlans);
    expect(global.totalRevenus).toBe(3 * one.totalRevenus);
    expect(global.totalCharges).toBe(3 * one.totalCharges);
    expect(global.net).toBeCloseTo(3 * one.net);
    expect(global.totalPax).toBe(3 * one.totalPax);
  });

  it('returns zeroed result for empty seminar list', () => {
    const global = aggregatePlanGlobally([]);
    expect(global.totalRevenus).toBe(0);
    expect(global.totalCharges).toBe(0);
    expect(global.charges.billet_avion).toBe(0);
    expect(global.charges.transport).toBe(0);
  });

  it('breakdown charges sum equals totalCharges (global reconciliation invariant)', () => {
    const semPlans = [
      makePlan({ billet_avion: 800_000, transport: 120_000 }),
      makePlan({ billet_avion: 600_000, transport: 150_000 }),
    ];
    const global = aggregatePlanGlobally(semPlans);
    const breakdownSum = Object.values(global.charges).reduce((a, b) => a + b, 0);
    // This is the invariant the bug violated: breakdown pie chart should sum
    // to the global totalCharges figure shown on the dashboard card.
    expect(breakdownSum).toBe(global.totalCharges);
  });
});
