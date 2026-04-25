import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { generatePaymentReference } from "./payment-reference.js";
import { REFERRAL_CHANNELS } from "../../src/types/registration.js";

export const RegisterBodySchema = z
  .object({
    civilite: z.enum(["M.", "Mme"]).optional(),
    nom: z.string().trim().min(1).max(100),
    prenom: z.string().trim().min(1).max(100),
    email: z.string().trim().toLowerCase().email().max(200),
    tel: z.string().trim().max(40).optional(),
    societe: z.string().trim().max(200).optional(),
    fonction: z.string().trim().min(1).max(200),
    seminar: z.string().trim().min(1),
    referral_channel: z.enum(REFERRAL_CHANNELS),
    referrer_name: z.string().trim().max(200).optional(),
    channel_other: z.string().trim().max(500).optional(),
    consent: z.literal(true),
  })
  .superRefine((v, ctx) => {
    if (v.referral_channel === "Recommandation" && !v.referrer_name) {
      ctx.addIssue({
        code: "custom",
        path: ["referrer_name"],
        message: "required",
      });
    }
    if (v.referral_channel === "Autre" && !v.channel_other) {
      ctx.addIssue({
        code: "custom",
        path: ["channel_other"],
        message: "required",
      });
    }
  });

export type RegisterBody = z.infer<typeof RegisterBodySchema>;
export type { DedupState, DedupAction } from "../../src/types/registration.js";

import type { DedupState, DedupAction } from "../../src/types/registration.js";

export interface RegisterResult {
  status: "created" | "duplicate";
  participantId?: string;
  paymentReference?: string;
  state?: DedupState;
  actionTaken?: DedupAction;
}

interface ExistingRow {
  id: string;
  status: string | null;
  payment: string | null;
  payment_reference: string | null;
}

function classifyExisting(existing: ExistingRow): RegisterResult {
  if (existing.status === "confirmed") {
    return {
      status: "duplicate",
      state: "confirmed",
      actionTaken: "sent_magic_link",
      participantId: existing.id,
      paymentReference: existing.payment_reference ?? undefined,
    };
  }
  if (existing.status === "pending" && existing.payment === "paid") {
    return {
      status: "duplicate",
      state: "pending_paid",
      actionTaken: "none",
      participantId: existing.id,
      paymentReference: existing.payment_reference ?? undefined,
    };
  }
  return {
    status: "duplicate",
    state: "pending_unpaid",
    actionTaken: "resent_confirmation",
    participantId: existing.id,
    paymentReference: existing.payment_reference ?? undefined,
  };
}

export async function registerOrDedup(
  body: RegisterBody,
  supabase: SupabaseClient,
  amountFcfa: number,
): Promise<RegisterResult> {
  const { data: existing } = await supabase
    .from("participants")
    .select("id,status,payment,payment_reference")
    .eq("email", body.email)
    .eq("seminar", body.seminar)
    .neq("status", "cancelled")
    .limit(1)
    .maybeSingle();

  if (existing) return classifyExisting(existing as ExistingRow);

  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const provisionalId = crypto.randomUUID();
    const ref = generatePaymentReference(provisionalId);

    const { data: inserted, error } = await supabase
      .from("participants")
      .insert({
        id: provisionalId,
        civilite: body.civilite ?? null,
        nom: body.nom,
        prenom: body.prenom,
        email: body.email,
        tel: body.tel ?? null,
        societe: body.societe ?? null,
        fonction: body.fonction,
        seminar: body.seminar,
        amount: amountFcfa,
        status: "pending",
        payment: "pending",
        referral_channel: body.referral_channel,
        referrer_name: body.referrer_name ?? null,
        channel_other: body.channel_other ?? null,
        consent_at: new Date().toISOString(),
        payment_reference: ref,
      })
      .select("id")
      .single();

    if (!error && inserted) {
      return {
        status: "created",
        participantId: (inserted as { id: string }).id,
        paymentReference: ref,
      };
    }
    lastError = error;

    const code = (error as { code?: string } | null)?.code;
    if (code !== "23505") throw error;

    const detail =
      String((error as { message?: string } | null)?.message ?? "") +
      String((error as { details?: string } | null)?.details ?? "");

    if (detail.includes("payment_reference")) {
      // Birthday-paradox collision on generated reference. Retry with new id.
      continue;
    }
    if (detail.includes("email") || detail.includes("seminar")) {
      // TOCTOU race: another request inserted (email, seminar) between our
      // SELECT and INSERT. Re-run dedup lookup; the row exists now.
      const { data: raced } = await supabase
        .from("participants")
        .select("id,status,payment,payment_reference")
        .eq("email", body.email)
        .eq("seminar", body.seminar)
        .neq("status", "cancelled")
        .limit(1)
        .maybeSingle();
      if (!raced) throw error;
      return classifyExisting(raced as ExistingRow);
    }
    throw error;
  }
  throw lastError ?? new Error("registration: 3 collision retries exhausted");
}
