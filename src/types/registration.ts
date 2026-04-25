export const REFERRAL_CHANNELS = [
  "Recommandation",
  "LinkedIn",
  "Facebook",
  "Instagram",
  "Google",
  "Email",
  "Évènement",
  "Autre",
] as const;

export type ReferralChannel = (typeof REFERRAL_CHANNELS)[number];

export type DedupState = "pending_unpaid" | "pending_paid" | "confirmed";
export type DedupAction = "resent_confirmation" | "sent_magic_link" | "none";

export interface RegisterRequest {
  civilite?: "M." | "Mme";
  nom: string;
  prenom: string;
  email: string;
  tel?: string;
  societe?: string;
  fonction: string;
  seminar: string;
  referral_channel: ReferralChannel;
  referrer_name?: string;
  channel_other?: string;
  consent: true;
}

export interface RegisterCreatedResponse {
  participant_id: string;
  payment_reference: string;
}

export interface RegisterDuplicateResponse {
  error: "duplicate_registration";
  state: DedupState;
  payment_reference: string | null;
  action_taken: DedupAction;
}

export interface RegisterValidationResponse {
  error: "validation";
  issues: Array<{ path: (string | number)[]; message: string }>;
}
