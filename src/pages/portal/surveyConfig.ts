// ─────────────────────────────────────────────
// SURVEY CONFIG — Questions, recommendation engine
// ─────────────────────────────────────────────
import type { SurveyAnswer } from './tokens';

export type SurveyOption = string | { value: string; label: string };

export interface SurveyQuestion {
  id: 'secteur' | 'collaborateurs' | 'niveau' | 'defi' | 'attentes';
  label: string;
  type: 'select' | 'text' | 'multi';
  options: readonly SurveyOption[];
  encouragement: string;
}

export const SURVEY_QUESTIONS: readonly SurveyQuestion[] = [
  {
    id: 'secteur',
    label: "Quel est votre secteur d'activité ?",
    type: 'select',
    options: ['Banque', 'Assurance', 'Immobilier', 'Juridique', 'RH', 'Technologie', 'Autre'],
    encouragement: 'Excellent choix !',
  },
  {
    id: 'collaborateurs',
    label: 'Combien de collaborateurs avez-vous ?',
    type: 'select',
    options: ['1-10', '10-50', '50-200', '200+'],
    encouragement: 'Merci !',
  },
  {
    id: 'niveau',
    label: "Quel est votre niveau d'expertise en IA ?",
    type: 'select',
    options: [
      { value: 'Débutant', label: "Débutant — je découvre, peu ou pas d'utilisation" },
      { value: 'Intermédiaire', label: "Intermédiaire — j'utilise occasionnellement quelques outils" },
      { value: 'Avancé', label: "Avancé — j'utilise régulièrement et maîtrise plusieurs outils" },
    ],
    encouragement: "C'est très bien !",
  },
  {
    id: 'defi',
    label: 'Quel est votre principal défi quotidien ?',
    type: 'text',
    options: [],
    encouragement: 'Merci pour cette précision !',
  },
  {
    id: 'attentes',
    label: "Qu'espérez-vous de cette formation ?",
    type: 'multi',
    options: ['Gagner du temps', 'Mieux décider', 'Former mon équipe', "Explorer l'IA", 'Autre'],
    encouragement: 'Parfait, nous avons bien noté !',
  },
];

export function getRecommendation(answers: SurveyAnswer): string {
  const { secteur, niveau, attentes } = answers;
  const isBeginner = niveau === 'Débutant';

  if (secteur === 'Banque' || secteur === 'Assurance') {
    return 'S2 — IA appliquée à la Finance : parfait pour analyser les bilans, gérer les risques et automatiser vos processus financiers.';
  }
  if (secteur === 'Juridique') {
    return "S3 — IA pour les Notaires : idéal pour moderniser votre pratique juridique avec l'IA.";
  }
  if (secteur === 'RH') {
    return 'S4 — IA pour les Ressources Humaines : transformez votre fonction RH avec des outils IA performants.';
  }
  if (isBeginner || attentes.includes("Explorer l'IA")) {
    return "S1 — IA Stratégique pour Dirigeants : la formation idéale pour découvrir l'IA et construire votre vision stratégique.";
  }
  if (attentes.includes('Former mon équipe')) {
    return "S1 — IA Stratégique pour Dirigeants + un Coaching Personnalisé pour accompagner votre équipe dans l'adoption de l'IA.";
  }
  return "S1 — IA Stratégique pour Dirigeants : le point de départ idéal pour intégrer l'IA dans votre organisation.";
}
