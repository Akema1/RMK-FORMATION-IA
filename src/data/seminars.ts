/**
 * Shared seminars data — single source of truth.
 * All pages and components should import from here instead of defining their own copy.
 */

export interface SeminarDates {
  start: string;
  presentiel: string;
  online: string;
}

export interface Seminar {
  id: string;
  code: string;
  title: string;
  subtitle: string;
  week: string;
  dates: SeminarDates;
  target: string;
  seats: number;
  color: string;
  gradient: string;
  icon: string;
  highlights: string[];
  modules: string[];
  // Admin-specific fields
  targets: string[];
  sectors: string[];
}

export const SEMINARS: Seminar[] = [
  {
    id: "s1",
    code: "S1",
    title: "IA Stratégique pour Dirigeants",
    subtitle: "Leadership & Transformation Digitale",
    week: "26 – 30 Mai 2026",
    dates: { start: "2026-05-26", presentiel: "Mar 26 – Jeu 28 Mai", online: "Ven 29 – Sam 30 Mai" },
    target: "Managers, Dirigeants, Administrateurs, Consultants, Entrepreneurs, Cadres Supérieurs et Professionnels",
    seats: 20,
    color: "#2980B9",
    gradient: "linear-gradient(135deg, #2980B9 0%, #74B9FF 100%)",
    icon: "Briefcase",
    highlights: [
      "Comprendre les transformations économiques liées à l'IA",
      "Prompt engineering stratégique pour la prise de décision",
      "Construction d'agents IA personnalisés (Claude Projects)",
      "Connecteurs MCP, Skills & Plugins pour l'entreprise",
      "Plan d'action IA individuel avec feuille de route",
    ],
    modules: ["IA & Transformation du Leadership", "Prompt Engineering Stratégique", "IA & Décision Augmentée", "Construction d'Agents IA", "Feuille de Route Personnelle"],
    targets: ["DG", "CEO", "DGA", "Directeurs de département", "Cadres dirigeants"],
    sectors: ["Banque", "Assurance", "Télécoms", "Énergie", "Distribution", "Industrie"],
  },
  {
    id: "s2",
    code: "S2",
    title: "IA appliquée à la Finance",
    subtitle: "Analyse Financière & Gestion des Risques",
    week: "2 – 6 Juin 2026",
    dates: { start: "2026-06-02", presentiel: "Mar 2 – Jeu 4 Juin", online: "Ven 5 – Sam 6 Juin" },
    target: "DAF, Analystes financiers, Banquiers, Risk Managers, Contrôleurs de gestion",
    seats: 20,
    color: "#2980B9",
    gradient: "linear-gradient(135deg, #2980B9 0%, #74B9FF 100%)",
    icon: "BarChart3",
    highlights: [
      "Analyse automatisée des bilans et comptes de résultat",
      "Prompting appliqué à l'analyse financière et au reporting",
      "Identification et anticipation des risques financiers",
      "Simulation de scénarios économiques avec l'IA",
      "IA et conformité bancaire (BCEAO, UEMOA)",
    ],
    modules: ["IA & Métiers de la Finance", "Prompt Engineering Financier", "Analyse des États Financiers", "Gestion des Risques", "Prise de Décision & Conformité"],
    targets: ["DAF", "Analystes financiers", "Trésoriers", "Risk Managers", "Contrôleurs de gestion"],
    sectors: ["Banques (SGBCI, SIB, BICICI, Ecobank)", "Assurances", "SGI", "Microfinance", "BCEAO/BRVM"],
  },
  {
    id: "s3",
    code: "S3",
    title: "IA pour les Notaires",
    subtitle: "Modernisation des Études Notariales",
    week: "9 – 13 Juin 2026",
    dates: { start: "2026-06-09", presentiel: "Mar 9 – Jeu 11 Juin", online: "Ven 12 – Sam 13 Juin" },
    target: "Notaires, Clercs de notaires, Collaborateurs d'études, Juristes",
    seats: 15,
    color: "#2980B9",
    gradient: "linear-gradient(135deg, #2980B9 0%, #74B9FF 100%)",
    icon: "Scale",
    highlights: [
      "Rédaction assistée d'actes notariaux avec l'IA",
      "Analyse de clauses contractuelles et risques juridiques",
      "Organisation intelligente des dossiers et documents",
      "Prompt engineering juridique professionnel",
      "Sécurité des données et responsabilité professionnelle",
    ],
    modules: ["IA & Pratique Notariale", "Prompt Engineering Juridique", "Rédaction d'Actes Assistée", "Analyse de Contrats", "Modernisation des Études"],
    targets: ["Notaires", "Clercs de notaires", "Collaborateurs d'études", "Juristes immobilier"],
    sectors: ["Études notariales Abidjan", "Études notariales hors Abidjan", "Cabinets juridiques"],
  },
  {
    id: "s4",
    code: "S4",
    title: "IA pour les Ressources Humaines",
    subtitle: "Transformer la Fonction RH",
    week: "16 – 20 Juin 2026",
    dates: { start: "2026-06-16", presentiel: "Mar 16 – Jeu 18 Juin", online: "Ven 19 – Sam 20 Juin" },
    target: "DRH, Responsables RH, Chargés de recrutement, Responsables formation",
    seats: 15,
    color: "#2980B9",
    gradient: "linear-gradient(135deg, #2980B9 0%, #74B9FF 100%)",
    icon: "Users",
    highlights: [
      "Rédaction d'offres d'emploi et analyse de CV avec l'IA",
      "Préparation d'entretiens et évaluation des compétences",
      "Gestion des talents et plans de carrière augmentés",
      "Communication RH et notes internes optimisées",
      "Planification stratégique des ressources humaines",
    ],
    modules: ["IA & Transformation RH", "Prompt Engineering RH", "Recrutement & Talents", "Communication RH", "Gestion Stratégique"],
    targets: ["DRH", "Responsables RH", "Chargés de recrutement", "Responsables formation", "Managers"],
    sectors: ["Multinationales CI", "Grandes entreprises locales", "Secteur public", "ONG internationales"],
  },
];

// Lucide icon name → component map (used by rendering components)
export { Briefcase, BarChart3, Scale, Users } from 'lucide-react';
export const SEMINAR_ICONS: Record<string, string> = {
  Briefcase: "Briefcase",
  BarChart3: "BarChart3",
  Scale: "Scale",
  Users: "Users",
};

// Pricing constants
export const PRICE = 600000;
export const PRICE_DIRIGEANTS = 680000;
export const EARLY_BIRD_PRICE = 540000;
// Early-bird: 10% off when purchased 15+ days before the first Atelier (S1 starts 2026-05-26).
export const EARLY_BIRD_DEADLINE = new Date("2026-05-11T23:59:59");
export const EARLY_BIRD_DAYS_BEFORE = 15;
export const COACHING_PRICE = 100000; // par session de 2h (inclus pour dirigeants, optionnel pour les autres)

// Formatting helper
export const fmt = (n: number) => typeof n === 'number' ? n.toLocaleString("fr-FR") : n;
