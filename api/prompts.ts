/**
 * Server-side AI prompt templates.
 *
 * Clients send only a `templateId` (+ optional `vars`). The server renders the
 * actual system prompt from a fixed whitelist. This prevents prompt-injection /
 * budget-abuse where an authenticated client could otherwise repurpose the
 * Claude Haiku endpoint for arbitrary workloads via `systemPrompt`.
 *
 * Adding a new template:
 *   1. Add it to PROMPT_TEMPLATES below
 *   2. Add its id to the TemplateId union
 *   3. Declare its expected `vars` shape
 */
import { SEMINARS } from "../src/data/seminars.js";
import { COMMERCIAL_STRATEGY } from "../src/lib/strategy.js";

export type TemplateId = "seo" | "commercial" | "research";

// Escape XML metacharacters to prevent tag-closing prompt-injection inside templated values.
function esc(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export interface CommercialVars {
  seminarId: string;
}

export type RenderVars = CommercialVars | Record<string, never> | undefined;

/**
 * Render a system prompt from a template id + vars. Throws if the id is
 * unknown or required vars are missing/invalid.
 */
export function renderSystemPrompt(
  templateId: TemplateId,
  vars: RenderVars
): string {
  switch (templateId) {
    case "seo":
      return "Tu es un expert SEO B2B. Réponds en français. Fournis des recommandations concrètes, actionnables et adaptées au marché ivoirien/ouest-africain.";

    case "research":
      return `Tu es un assistant de recherche pour RMK, société qui organise des séminaires de formation IA à Abidjan en mai 2026. Tu dois fournir des estimations de prix détaillées et réalistes basées sur le marché ivoirien/ouest-africain.

Pour chaque recherche, fournis:
1. FOURCHETTE DE PRIX en FCFA (minimum – moyen – maximum)
2. Les prestataires recommandés avec noms et contacts si possible
3. Conseils de négociation
4. Alternatives économiques
5. Timing de réservation optimal
6. Conditions et inclusions typiques

Sois très concret et adapté au contexte d'Abidjan, Côte d'Ivoire. Utilise les prix réels du marché local. Monnaie: FCFA (XOF).`;

    case "commercial": {
      const seminarId = (vars as CommercialVars | undefined)?.seminarId;
      if (!seminarId || typeof seminarId !== "string") {
        throw new Error("commercial template requires vars.seminarId");
      }
      const s = SEMINARS.find((x) => x.id === seminarId);
      if (!s) {
        throw new Error("Unknown seminarId");
      }
      return `Tu es un agent commercial expert pour RMK Conseils, société qui organise des séminaires de formation en Intelligence Artificielle à Abidjan, Côte d'Ivoire. La formation est délivrée par CABEXIA, Cabinet d'Expertise en IA.

Voici la stratégie commerciale globale de l'événement :
${COMMERCIAL_STRATEGY}

Tu dois identifier les MEILLEURS profils de participants potentiels pour le séminaire "${esc(s.title)}" (${esc(s.week)}).

Contexte marché Abidjan:
- 1ère place financière UEMOA (BRVM, BCEAO)
- 28 banques commerciales, nombreuses SGI et assurances
- 500+ grandes entreprises et multinationales
- Écosystème tech en croissance +15% annuel
- Mobile money: Orange Money, MTN MoMo, Wave

Profils cibles: ${s.targets.map(esc).join(", ")}
Secteurs prioritaires: ${s.sectors.map(esc).join(", ")}
Prix: 600 000 FCFA (5 jours hybride: 3 présentiel + 2 en ligne)
Places: ${s.seats} maximum

Réponds en français. Fournis un plan de prospection journalier avec:
1. TOP 10 entreprises/institutions à contacter en priorité à Abidjan (noms réels)
2. Les profils décideurs clés dans chaque entreprise (titres de poste)
3. Argumentaire de vente adapté au secteur
4. Script d'approche LinkedIn (message InMail)
5. Script WhatsApp de premier contact
6. Objections probables et réponses
7. Canaux de contact recommandés par cible`;
    }

    default: {
      // Exhaustiveness check
      const _never: never = templateId;
      throw new Error(`Unknown templateId: ${String(_never)}`);
    }
  }
}

export const PROMPT_TEMPLATES: readonly TemplateId[] = [
  "seo",
  "commercial",
  "research",
] as const;
