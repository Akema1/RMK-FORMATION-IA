// Postgres SQLSTATE → user-facing French banner mapping for the public
// registration surface. Imported by both LandingPage.tsx (runtime) and the
// Vitest suite (guards the mapping against drift), so the test validates
// the same code that actually runs in production.

export type RegistrationBanner = {
  /** Text to surface in the `_global` errors slot. */
  message: string;
  /** Whether the full-atelier list should be re-fetched after this error. */
  refetchCapacity: boolean;
};

export const DUPLICATE_BANNER: RegistrationBanner = {
  message:
    "Vous êtes déjà inscrit(e) à cet atelier. Consultez le Portail Client pour suivre votre inscription.",
  refetchCapacity: false,
};

export const CAPACITY_BANNER: RegistrationBanner = {
  message:
    "Atelier complet. Choisissez un autre atelier ou contactez-nous pour la liste d'attente.",
  refetchCapacity: true,
};

/**
 * Map a Postgres error shape (as surfaced by supabase-js) to a localized
 * banner. Returns `null` for codes the caller should re-throw.
 *
 *  - 23505 → unique_violation from participants_email_seminar_active_udx.
 *  - P0013 → custom SQLSTATE raised by enforce_seminar_capacity() trigger.
 */
export function registrationErrorToBanner(err: {
  code?: string;
}): RegistrationBanner | null {
  switch (err.code) {
    case "23505":
      return DUPLICATE_BANNER;
    case "P0013":
      return CAPACITY_BANNER;
    default:
      return null;
  }
}
