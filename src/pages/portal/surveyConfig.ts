// ─────────────────────────────────────────────
// SURVEY CONFIG — Questions, recommendation engine
// ─────────────────────────────────────────────
import type { SurveyAnswer } from './tokens';

export const SURVEY_QUESTIONS = [
  {
    id: 'secteur' as const,
    label: "Quel est votre secteur d'activite ?",
    type: 'select' as const,
    options: ['Banque', 'Assurance', 'Immobilier', 'Juridique', 'RH', 'Technologie', 'Autre'],
    encouragement: 'Excellent choix !',
  },
  {
    id: 'collaborateurs' as const,
    label: 'Combien de collaborateurs avez-vous ?',
    type: 'select' as const,
    options: ['1-10', '10-50', '50-200', '200+'],
    encouragement: 'Merci !',
  },
  {
    id: 'aiUsage' as const,
    label: "Utilisez-vous deja des outils d'IA ?",
    type: 'select' as const,
    options: ['Oui regulierement', 'Oui un peu', 'Pas encore'],
    encouragement: "C'est tres bien !",
  },
  {
    id: 'defi' as const,
    label: 'Quel est votre principal defi quotidien ?',
    type: 'text' as const,
    options: [] as string[],
    encouragement: 'Merci pour cette precision !',
  },
  {
    id: 'attentes' as const,
    label: "Qu'esperez-vous de cette formation ?",
    type: 'multi' as const,
    options: ['Gagner du temps', 'Mieux decider', 'Former mon equipe', "Explorer l'IA", 'Autre'],
    encouragement: 'Parfait, nous avons bien note !',
  },
  {
    id: 'source' as const,
    label: 'Comment avez-vous connu RMK Conseils ?',
    type: 'select' as const,
    options: ['Recommandation', 'LinkedIn', 'Google', 'Autre'],
    encouragement: "Merci d'avoir partage !",
  },
];

export function getRecommendation(answers: SurveyAnswer): string {
  const { secteur, aiUsage, attentes } = answers;

  if (secteur === 'Banque' || secteur === 'Assurance') {
    return 'S2 - IA appliquee a la Finance : parfait pour analyser les bilans, gerer les risques et automatiser vos processus financiers.';
  }
  if (secteur === 'Juridique') {
    return "S3 - IA pour les Notaires : ideal pour moderniser votre pratique juridique avec l'IA.";
  }
  if (secteur === 'RH') {
    return 'S4 - IA pour les Ressources Humaines : transformez votre fonction RH avec des outils IA performants.';
  }
  if (aiUsage === 'Pas encore' || attentes.includes("Explorer l'IA")) {
    return "S1 - IA Strategique pour Dirigeants : la formation ideale pour decouvrir l'IA et construire votre vision strategique.";
  }
  if (attentes.includes('Former mon equipe')) {
    return "S1 - IA Strategique pour Dirigeants + un Coaching Personnalise pour accompagner votre equipe dans l'adoption de l'IA.";
  }
  return "S1 - IA Strategique pour Dirigeants : le point de depart ideal pour integrer l'IA dans votre organisation.";
}
