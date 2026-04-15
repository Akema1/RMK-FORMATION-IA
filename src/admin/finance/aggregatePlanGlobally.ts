import type { FinancialResult } from '../types';

/**
 * Aggregates a list of per-seminar plan results into a single global view.
 *
 * Sums every numeric field (top-level P&L + every charges breakdown field)
 * across all seminars. All fields are summed symmetrically — there is no
 * special case for billet_avion or transport.
 *
 * Upstream had a bug here: billet_avion and transport were taking
 * `semPlans[0]?.charges.X || 0` instead of being reduced. This broke the
 * breakdown-sum-equals-totalCharges invariant in the global view and was
 * flagged by both Gemini and Qwen on the Sprint 7 Phase 2 review. The
 * aggregatePlanGlobally helper keeps the logic centralized so future ports
 * from upstream cannot silently reintroduce the regression.
 *
 * Pure function — safe to unit-test, no React or Supabase dependencies.
 */
export function aggregatePlanGlobally(semPlans: FinancialResult[]): FinancialResult {
  const sum = (get: (p: FinancialResult) => number) =>
    semPlans.reduce((acc, p) => acc + get(p), 0);

  return {
    qtyStandard: sum(p => p.qtyStandard),
    qtyEarlyBird: sum(p => p.qtyEarlyBird),
    totalPax: sum(p => p.totalPax),
    revStandard: sum(p => p.revStandard),
    revEarlyBird: sum(p => p.revEarlyBird),
    totalRevenus: sum(p => p.totalRevenus),
    charges: {
      consultance_pres: sum(p => p.charges.consultance_pres),
      consultance_ligne: sum(p => p.charges.consultance_ligne),
      billet_avion: sum(p => p.charges.billet_avion),
      sejour: sum(p => p.charges.sejour),
      salle: sum(p => p.charges.salle),
      pauses_cafe: sum(p => p.charges.pauses_cafe),
      dejeuner: sum(p => p.charges.dejeuner),
      supports: sum(p => p.charges.supports),
      equipements: sum(p => p.charges.equipements),
      divers: sum(p => p.charges.divers),
      transport: sum(p => p.charges.transport),
      commercialisation: sum(p => p.charges.commercialisation),
    },
    totalCharges: sum(p => p.totalCharges),
    revenuProv: sum(p => p.revenuProv),
    imprevu: sum(p => p.imprevu),
    sousTotalBrut: sum(p => p.sousTotalBrut),
    tva: sum(p => p.tva),
    net: sum(p => p.net),
  };
}
