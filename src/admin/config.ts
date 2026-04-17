import React from 'react';
import { SEMINARS as BASE_SEMINARS } from '../data/seminars';
import { Briefcase, BarChart3, Scale, Users, type LucideIcon } from "lucide-react";
import type { Seminar, BudgetConfig, Prices, SeminarPricing, TeamMember, Venue, Speaker, FormationTemplate } from './types';

// ─── DEFAULT DATA ───
export const DEFAULT_SEMINARS: Seminar[] = BASE_SEMINARS.map(s => ({
  ...s,
  flyer_subtitle: s.subtitle,
  flyer_highlight: s.highlights[0] || "",
  flyer_bullets: s.highlights.slice(0, 3),
  flyer_image: "",
}));

export const DEFAULT_PRICES: Prices = {
  standard: 600000,
  earlyBird: 540000,
  discountPct: 10,
  dirigeants: 680000,
  coaching: 100000,
  packDiscount3: 15,
  packDiscount2sem: 10,
  packDiscount4sem: 20,
};

export const DEFAULT_SEMINAR_PRICING: SeminarPricing = {
  price: 600000,
  earlyBirdPct: 10,
  coachingPrice: 100000,
  packDiscount3Enabled: true,
  packDiscount2semEnabled: true,
  packDiscount4semEnabled: true,
};

export const DEFAULT_BUDGET_CONFIG: BudgetConfig = {
  consultance_pres: 1050000,
  consultance_ligne: 400000,
  billet_avion: 650000,
  sejour: 480000,
  salle: 450000,
  pauses_cafe: 450000,
  dejeuner: 675000,
  supports: 75000,
  equipements: 150000,
  divers: 100000,
  transport: 150000,
  commercialisation_pct: 0.1
};

export const TEAM: TeamMember[] = [
  {
    id: "rosine",
    name: "Rosine K.",
    role: "Opérations & Commercial",
    avatar: "RK",
  },
  {
    id: "alexis",
    name: "Alexis Dogbo",
    role: "Coaching IA & Transformation Digitale",
    avatar: "AD",
    bio: "Spécialiste en transformation digitale et Intelligence Artificielle. Responsable du coaching à Abidjan et du développement de solutions IA sur-mesure pour les entreprises. Assistant formateur pendant les ateliers RMK × CABEXIA.",
    expertise: ["Transformation digitale", "IA appliquée", "Coaching entreprise", "Solutions sur-mesure"],
  },
  {
    id: "eric",
    name: "Eric Atta",
    role: "Coaching IA & Solutions Entreprise",
    avatar: "EA",
    bio: "Expert en transformation digitale et Intelligence Artificielle. Co-responsable du coaching à Abidjan et de l'accompagnement des entreprises dans le développement de solutions IA adaptées à leurs besoins spécifiques.",
    expertise: ["Transformation digitale", "IA générative", "Accompagnement entreprise", "Développement IA sur-mesure"],
  },
];

export const EXPENSE_CATEGORIES = [
  { value: "consultance_pres", label: "Consultance (Présentiel)" },
  { value: "consultance_ligne", label: "Consultance (En Ligne)" },
  { value: "billet_avion", label: "Billet d'avion" },
  { value: "sejour", label: "Hébergement / Séjour" },
  { value: "salle", label: "Location Salle" },
  { value: "pauses_cafe", label: "Pauses Café" },
  { value: "dejeuner", label: "Déjeuners" },
  { value: "supports", label: "Supports Pédagogiques" },
  { value: "equipements", label: "Équipements" },
  { value: "commercialisation", label: "Communication / Mkt" },
  { value: "transport", label: "Transport local" },
  { value: "divers", label: "Divers & Imprévus" }
] as const;

// ─── ICON MAPS ───
// Emoji map for <option> elements (can't render React components in <option>)
export const ICON_EMOJI: Record<string, string> = {
  Briefcase: "💼",
  BarChart3: "📊",
  Scale: "⚖️",
  Users: "👥",
};

// Lucide icon component map for rendering outside <select>
export const ICON_MAP: Record<string, LucideIcon> = { Briefcase, BarChart3, Scale, Users };

// ─── COLORS ───
export const SURFACE_BG = "#FAF9F6";
export const ORANGE = "#C9A84C";

// ─── SHARED STYLES ───
export const card: React.CSSProperties = {
  background: "rgba(0,0,0,0.04)",
  border: "1px solid rgba(0,0,0,0.08)",
  borderRadius: 16,
  padding: 24,
};

export const inputS: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,0.12)",
  fontSize: 14,
  fontFamily: "inherit",
  background: "rgba(0,0,0,0.06)",
  color: "#1B2A4A",
  outline: "none",
  boxSizing: "border-box",
};

export const selectS: React.CSSProperties = { ...inputS, cursor: "pointer" };

export const btnPrimary: React.CSSProperties = {
  background: `linear-gradient(135deg,${ORANGE},#A88A3D)`,
  color: "#fff",
  border: "none",
  padding: "12px 24px",
  borderRadius: 10,
  fontWeight: 700,
  fontSize: 14,
  cursor: "pointer",
  transition: "all 0.2s",
};

export const btnSecondary: React.CSSProperties = {
  background: "rgba(0,0,0,0.06)",
  color: "#1B2A4A",
  border: "1px solid rgba(0,0,0,0.12)",
  padding: "10px 20px",
  borderRadius: 10,
  fontWeight: 600,
  fontSize: 13,
  cursor: "pointer",
};

export const badge = (color: string): React.CSSProperties => ({
  display: "inline-block",
  padding: "3px 10px",
  borderRadius: 100,
  fontSize: 11,
  fontWeight: 700,
  background: `${color}22`,
  color,
});

export const label: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: '#1B2A4A',
  display: "block",
  marginBottom: 6,
  letterSpacing: 0.5,
  textTransform: "uppercase",
};


// ─── VENUES DATABASE (Hôtels Abidjan) ───
export const DEFAULT_VENUES: Venue[] = [
  {
    id: "v1", name: "Hôtel Ivoire Sofitel", address: "Boulevard Hassan II, Cocody", zone: "Cocody",
    stars: 5, capacity_max: 500, capacity_seminar: 200,
    tarif_demi_journee: 450000, tarif_journee: 850000, tarif_semaine: 3500000,
    contact_name: "Konan Ama", contact_phone: "+225 27 22 48 26 00", contact_email: "events@sofitel-abidjan.com",
    services: ["wifi", "projecteur", "écran interactif", "catering", "parking", "climatisation"],
    notes: "Salle de conférence premium, vue panoramique sur la lagune"
  },
  {
    id: "v2", name: "Radisson Blu Abidjan", address: "Avenue Lamblin, Plateau", zone: "Plateau",
    stars: 5, capacity_max: 400, capacity_seminar: 150,
    tarif_demi_journee: 400000, tarif_journee: 780000, tarif_semaine: 3200000,
    contact_name: "Diallo Fatoumata", contact_phone: "+225 27 22 20 20 10", contact_email: "events@radissonblu-abidjan.com",
    services: ["wifi", "projecteur 4K", "visioconférence", "catering", "parking VIP"],
    notes: "Salles modulables, équipement AV haut de gamme"
  },
  {
    id: "v3", name: "Pullman Abidjan", address: "Rue du Commerce, Plateau", zone: "Plateau",
    stars: 5, capacity_max: 350, capacity_seminar: 120,
    tarif_demi_journee: 380000, tarif_journee: 720000, tarif_semaine: 2950000,
    contact_name: "Kouamé Eric", contact_phone: "+225 27 20 22 23 00", contact_email: "h2275-sb3@accor.com",
    services: ["wifi", "projecteur", "catering", "parking", "restaurant gastronomique"],
    notes: "Cadre business international, service 5 étoiles"
  },
  {
    id: "v4", name: "Hôtel du Plateau", address: "Avenue Botreau Roussel, Plateau", zone: "Plateau",
    stars: 4, capacity_max: 200, capacity_seminar: 80,
    tarif_demi_journee: 230000, tarif_journee: 450000, tarif_semaine: 1800000,
    contact_name: "N'Goran Sylvie", contact_phone: "+225 27 22 32 10 10", contact_email: "seminaires@hotelduplateau.ci",
    services: ["wifi", "projecteur", "catering", "parking"],
    notes: "Hôtel historique du Plateau, ambiance professionnelle"
  },
  {
    id: "v5", name: "Novotel Abidjan", address: "Rue des Jardins, Plateau", zone: "Plateau",
    stars: 4, capacity_max: 300, capacity_seminar: 100,
    tarif_demi_journee: 250000, tarif_journee: 480000, tarif_semaine: 1950000,
    contact_name: "Touré Jean-Marc", contact_phone: "+225 27 22 50 01 00", contact_email: "h1477-sb@accor.com",
    services: ["wifi", "projecteur", "tableaux blancs", "catering", "parking"],
    notes: "Salles lumineuses, cocktail dînatoire possible"
  },
  {
    id: "v6", name: "Hôtel Tiama", address: "Rue du Général de Gaulle, Plateau", zone: "Plateau",
    stars: 4, capacity_max: 150, capacity_seminar: 60,
    tarif_demi_journee: 200000, tarif_journee: 380000, tarif_semaine: 1550000,
    contact_name: "Bamba Mariam", contact_phone: "+225 27 22 21 78 00", contact_email: "commercial@tiama-hotel.ci",
    services: ["wifi", "projecteur", "catering"],
    notes: "Hôtel boutique, ambiance feutrée pour ateliers exclusifs"
  },
  {
    id: "v7", name: "Hôtel Président", address: "Boulevard de la République, Plateau", zone: "Plateau",
    stars: 4, capacity_max: 180, capacity_seminar: 70,
    tarif_demi_journee: 220000, tarif_journee: 420000, tarif_semaine: 1700000,
    contact_name: "Assié Christophe", contact_phone: "+225 27 22 21 20 20", contact_email: "events@hotelpresident.ci",
    services: ["wifi", "projecteur", "climatisation", "catering", "parking"],
    notes: "Vue sur la baie de Cocody, sécurité renforcée"
  },
  {
    id: "v8", name: "Azalaï Hôtel Abidjan", address: "Rue des Blokkaus, Zone 4", zone: "Zone 4",
    stars: 4, capacity_max: 250, capacity_seminar: 90,
    tarif_demi_journee: 210000, tarif_journee: 400000, tarif_semaine: 1620000,
    contact_name: "Diaby Aminata", contact_phone: "+225 27 21 75 00 00", contact_email: "abidjan@azalaihotels.com",
    services: ["wifi", "projecteur", "visioconférence", "catering", "parking gratuit"],
    notes: "Réseau hôtelier panafricain, équipements modernes"
  },
  {
    id: "v9", name: "Palm Club Hôtel", address: "Rue des Palmiers, Cocody", zone: "Cocody",
    stars: 3, capacity_max: 100, capacity_seminar: 40,
    tarif_demi_journee: 120000, tarif_journee: 220000, tarif_semaine: 880000,
    contact_name: "Koné Bakary", contact_phone: "+225 27 22 44 10 00", contact_email: "palmclub@aviso.ci",
    services: ["wifi", "projecteur", "parking"],
    notes: "Idéal pour petits groupes, cadre verdoyant"
  },
  {
    id: "v10", name: "Golden Tulip Le Diplomate", address: "Deux-Plateaux, Cocody", zone: "Cocody",
    stars: 4, capacity_max: 220, capacity_seminar: 80,
    tarif_demi_journee: 185000, tarif_journee: 350000, tarif_semaine: 1420000,
    contact_name: "Traoré Isabelle", contact_phone: "+225 27 22 41 00 00", contact_email: "events@goldentulip-abidjan.com",
    services: ["wifi", "projecteur", "catering", "parking", "piscine"],
    notes: "Quartier résidentiel Cocody, parking spacieux"
  },
  {
    id: "v11", name: "Hôtel Noom Abidjan", address: "Rue du Commerce, Plateau", zone: "Plateau",
    stars: 5, capacity_max: 400, capacity_seminar: 180,
    tarif_demi_journee: 420000, tarif_journee: 800000, tarif_semaine: 3300000,
    contact_name: "Coulibaly Aminata", contact_phone: "+225 27 20 30 40 50", contact_email: "events@noom-abidjan.com",
    services: ["wifi", "projecteur 4K", "visioconférence", "catering", "parking VIP", "climatisation"],
    notes: "Hôtel contemporain design, salles modulables avec vue sur la lagune"
  },
  {
    id: "v12", name: "Mövenpick Hôtel Abidjan", address: "Rue des Jardins, Plateau", zone: "Plateau",
    stars: 5, capacity_max: 350, capacity_seminar: 150,
    tarif_demi_journee: 390000, tarif_journee: 740000, tarif_semaine: 3050000,
    contact_name: "Bah Oumou", contact_phone: "+225 27 21 00 10 00", contact_email: "events@movenpick-abidjan.com",
    services: ["wifi", "projecteur", "catering", "parking", "restaurant gastronomique"],
    notes: "Standard international Mövenpick, service haut de gamme"
  },
];


// ─── SPEAKERS DATABASE (Intervenants IA) ───
export const DEFAULT_SPEAKERS: Speaker[] = [
  {
    id: "sp0", name: "Djimtahadoum Memtingar",
    title: "Expert-Consultant & Formateur en IA Générative",
    company: "CABEXIA — Cabinet d'Expertise en Intelligence Artificielle",
    expertise: ["IA générative", "Prompt Engineering avancé", "Conseil stratégique IA", "Transformation digitale", "Conférences internationales"],
    linkedin_url: "https://linkedin.com/in/djimtahadoum-memtingar",
    email: "contact@cabex-ia.com", phone: "+235 61 47 91 19",
    tarif_demi_journee: 175000, tarif_journee: 350000, disponible: true,
    langues: ["Français", "Arabe"],
    note: "Fondateur CABEXIA. 10+ entreprises, 230+ professionnels formés, 400+ ateliers, 10 000+ participants grand public. Formateur référent RMK Conseils.",
    avatar_initials: "DM",
    biography: "Expert-consultant, formateur et conférencier en intelligence artificielle générative, reconnu pour sa capacité à rendre l'IA concrète, accessible et immédiatement utile aux professionnels, aux institutions et aux entreprises. À travers CABEXIA, il accompagne la transformation des pratiques de travail en mettant l'intelligence artificielle au service de la productivité, de la performance et de la qualité des livrables. Son approche est résolument pratique, orientée résultats et conçue pour répondre aux réalités du terrain africain.",
    formations_history: [
      "Programme de formation de 2 000 jeunes à l'IA — Ministère des Postes & Économie Numérique (Tchad)",
      "Formation des femmes du Ministère du Pétrole, des Mines et de la Géologie",
      "Formation de 63 femmes journalistes — HAMA (Haute Autorité des Médias Audiovisuels)",
      "Formation de hauts cadres financiers — Guessconsulting Finance & Investissement",
      "Consultant au Rectorat universitaire du Tchad — intégration IA dans l'enseignement supérieur",
      "Consultant & formateur — Haute Autorité des Médias Audiovisuels (HAMA)",
      "Conférence Forum de Tunis — 6e Forum International, Deepfakes & mesures de protection",
      "Conférence ECOBANK — IA & éducation",
      "Conférence UBA — IA & entrepreneuriat",
    ],
  },
  {
    id: "sp1", name: "Dr. Koffi Mensah", title: "Expert IA Générative & NLP", company: "TechAfrica Solutions",
    expertise: ["IA générative", "NLP", "ChatGPT Enterprise", "Prompt Engineering"],
    linkedin_url: "https://linkedin.com/in/koffi-mensah-ia", email: "k.mensah@techafrica.ci", phone: "+225 07 08 09 10 11",
    tarif_demi_journee: 125000, tarif_journee: 250000, disponible: true,
    langues: ["Français", "Anglais"], note: "Intervenu à l'ENSEA, HEC Abidjan, ISTI", avatar_initials: "KM"
  },
  {
    id: "sp2", name: "Aminata Diallo", title: "Data Scientist & ML Engineer", company: "Dakar AI Hub",
    expertise: ["Machine Learning", "Data Science", "Python", "Analyse prédictive"],
    linkedin_url: "https://linkedin.com/in/aminata-diallo-ds", email: "a.diallo@dakarAI.sn", phone: "+221 77 123 45 67",
    tarif_demi_journee: 110000, tarif_journee: 220000, disponible: true,
    langues: ["Français", "Wolof", "Anglais"], note: "5 ans chez Orange Data Analytics, certifiée Google Cloud AI", avatar_initials: "AD"
  },
  {
    id: "sp3", name: "Jean-Baptiste Kouassi", title: "Expert Automatisation & RPA", company: "AutomateCI",
    expertise: ["Automatisation", "RPA", "Zapier/Make", "Agents IA", "No-code"],
    linkedin_url: "https://linkedin.com/in/jb-kouassi-automation", email: "jb@automate.ci", phone: "+225 05 06 07 08 09",
    tarif_demi_journee: 100000, tarif_journee: 200000, disponible: true,
    langues: ["Français", "Anglais"], note: "Formateur certifié Make.com et Zapier, 200+ automatisations déployées", avatar_initials: "JK"
  },
  {
    id: "sp4", name: "Fatou Ndiaye", title: "Experte IA & Finance / RegTech", company: "FinTech Afrique",
    expertise: ["IA & Finance", "RegTech", "Analyse de risque IA", "Crypto & Blockchain"],
    linkedin_url: "https://linkedin.com/in/fatou-ndiaye-fintech", email: "f.ndiaye@fintechafrique.com", phone: "+221 76 234 56 78",
    tarif_demi_journee: 115000, tarif_journee: 230000, disponible: true,
    langues: ["Français", "Anglais"], note: "Ancienne directrice Digital BICICI, board member GSMA Africa", avatar_initials: "FN"
  },
  {
    id: "sp5", name: "Marc Dupont", title: "Juriste spécialisé IA & LegalTech", company: "Cabinet LexIA",
    expertise: ["IA & Droit", "LegalTech", "RGPD Afrique", "Contrats IA", "Propriété intellectuelle"],
    linkedin_url: "https://linkedin.com/in/marc-dupont-legaltech", email: "m.dupont@lexia.ci", phone: "+225 07 12 34 56 78",
    tarif_demi_journee: 120000, tarif_journee: 240000, disponible: false,
    langues: ["Français"], note: "Doctorat droit numérique Paris II, expert OHADA digital", avatar_initials: "MD"
  },
  {
    id: "sp6", name: "Dr. Soro Ibrahim", title: "Expert IA & Santé / MedTech", company: "HealthIA Africa",
    expertise: ["IA Santé", "MedTech", "Diagnostic assisté par IA", "Télémédecine"],
    linkedin_url: "https://linkedin.com/in/soro-ibrahim-healthia", email: "i.soro@healthia-africa.com", phone: "+225 05 45 67 89 01",
    tarif_demi_journee: 130000, tarif_journee: 260000, disponible: true,
    langues: ["Français", "Anglais", "Dioula"], note: "Médecin + PhD en IA médicale, partenaire OMS Afrique", avatar_initials: "SI"
  },
  {
    id: "sp7", name: "Awa Coulibaly", title: "Experte IA & RH / People Analytics", company: "HRTech Côte d'Ivoire",
    expertise: ["IA & RH", "People Analytics", "Recrutement IA", "Bien-être & IA"],
    linkedin_url: "https://linkedin.com/in/awa-coulibaly-hrtech", email: "a.coulibaly@hrtech.ci", phone: "+225 07 56 78 90 12",
    tarif_demi_journee: 105000, tarif_journee: 210000, disponible: true,
    langues: ["Français"], note: "DRH ex-Nestlé Afrique, fondatrice HRTech CI", avatar_initials: "AC"
  },
  {
    id: "sp8", name: "Prof. Yao Akoto", title: "Expert IA & Enseignement / EdTech", company: "Université FHB",
    expertise: ["IA & Éducation", "EdTech", "ChatGPT pour enseignants", "Pédagogie numérique"],
    linkedin_url: "https://linkedin.com/in/yao-akoto-edtech", email: "y.akoto@ufhb.edu.ci", phone: "+225 05 23 45 67 89",
    tarif_demi_journee: 95000, tarif_journee: 190000, disponible: true,
    langues: ["Français", "Anglais", "Akan"], note: "Professeur UFHB, coordinateur programme IA MESRS Côte d'Ivoire", avatar_initials: "YA"
  },
];


// ─── FORMATION TEMPLATES CATALOGUE ───
export const DEFAULT_FORMATION_TEMPLATES: FormationTemplate[] = [
  {
    id: "ft-dirig", code: "FT-DIRIG", title: "IA Stratégique pour Dirigeants", sector: "Direction",
    description: "Maîtrisez l'IA générative pour transformer votre leadership, piloter avec agilité et prendre des décisions augmentées par l'intelligence artificielle.",
    target_audience: "PDG, DG, DGA, Directeurs généraux, Administrateurs",
    duration_days: 5,
    modules: [
      "IA & transformation du leadership et de la gouvernance d'entreprise",
      "Prompt engineering stratégique — maîtriser l'IA pour décider mieux",
      "Prise de décision augmentée : analyse, synthèse et prospective avec l'IA",
      "IA dans les fonctions clés : finance, RH, juridique, communication",
      "Gouvernance IA, éthique et responsabilité du dirigeant",
    ],
    min_participants: 8, max_participants: 20, base_price: 680000,
    tags: ["leadership", "stratégie", "IA générative", "gouvernance", "prompt engineering"]
  },
  {
    id: "ft-finance", code: "FT-FINANCE", title: "IA appliquée à la Finance", sector: "Finance",
    description: "Utilisez l'IA pour accélérer l'analyse financière, anticiper les risques et prendre de meilleures décisions d'investissement et de gestion.",
    target_audience: "DAF, Analystes financiers, Professionnels bancaires, Responsables risques, Contrôleurs de gestion, Responsables conformité",
    duration_days: 5,
    modules: [
      "IA et transformation des métiers de la finance — impact, opportunités et limites",
      "Prompt engineering appliqué à l'analyse financière et aux rapports",
      "IA et analyse des états financiers : bilans, indicateurs clés, fragilités",
      "IA et gestion des risques financiers : solvabilité, simulation de scénarios",
      "IA et prise de décision financière : analyse de projets, aide à la stratégie",
      "IA et conformité financière : réglementation, contrôle interne, audit",
    ],
    min_participants: 8, max_participants: 20, base_price: 600000,
    tags: ["finance", "risques", "conformité", "analyse financière", "prompt engineering"]
  },
  {
    id: "ft-juridique", code: "FT-JURIDIQUE", title: "IA pour les Notaires & Juristes", sector: "Juridique",
    description: "Intégrez l'IA dans votre pratique notariale pour accroître la productivité, optimiser la rédaction des actes et améliorer la qualité du conseil juridique.",
    target_audience: "Notaires, Clercs de notaires, Collaborateurs d'études notariales, Juristes spécialisés en droit immobilier et successions",
    duration_days: 5,
    modules: [
      "Maîtriser l'IA et le prompt engineering juridique — outils IAG pour la pratique notariale",
      "Prompt engineering pour les notaires : structure, techniques et analyse de textes juridiques",
      "IA et rédaction des actes notarials : rédaction assistée, structuration et automatisation",
      "IA et analyse des contrats : clauses contractuelles, risques et clauses sensibles",
      "IA et préparation des dossiers notarials : organisation et consultations",
      "Modernisation des études notariales : gestion des dossiers, relation client, sécurité juridique",
    ],
    min_participants: 8, max_participants: 20, base_price: 600000,
    tags: ["droit", "notariat", "LegalTech", "rédaction actes", "prompt engineering juridique"]
  },
  {
    id: "ft-rh", code: "FT-RH", title: "IA pour les Ressources Humaines", sector: "RH",
    description: "Transformez votre fonction RH grâce à l'IA générative : optimisez le recrutement, la gestion des talents, la communication interne et le pilotage stratégique.",
    target_audience: "DRH, Responsables RH, Chargés de recrutement, Responsables formation, Managers et responsables d'équipe",
    duration_days: 5,
    modules: [
      "IA et transformation de la fonction RH — impact sur les métiers et nouvelles compétences",
      "Prompt engineering appliqué aux RH : prompts professionnels pour la gestion des talents",
      "IA et recrutement : rédaction d'offres, analyse de CV, préparation d'entretiens",
      "IA et gestion des talents : compétences clés, évaluation des performances, plans de carrière",
      "IA et communication RH : communications internes, notes RH, communication organisationnelle",
      "IA et gestion stratégique des RH : planification, analyse des besoins, transformations",
    ],
    min_participants: 8, max_participants: 20, base_price: 600000,
    tags: ["RH", "recrutement", "gestion talents", "people analytics", "communication interne"]
  },
  {
    id: "ft-sante", code: "FT-SANTE", title: "IA & Santé / Médecine", sector: "Santé",
    description: "L'IA au service de la santé : diagnostic, gestion hospitalière et télémédecine.",
    target_audience: "Médecins, Infirmiers, Directeurs de cliniques, Pharmaciens",
    duration_days: 5,
    modules: ["Diagnostic assisté par IA", "IA & gestion hospitalière", "Télémédecine & IA", "Éthique IA en santé", "Atelier : dossier patient numérique IA"],
    min_participants: 6, max_participants: 18, base_price: 650000,
    tags: ["santé", "médecine", "diagnostic", "télémédecine"]
  },
  {
    id: "ft-marketing", code: "FT-MARKETING", title: "IA & Marketing Digital", sector: "Marketing",
    description: "Boostez votre marketing avec l'IA : contenu, ciblage, personnalisation et analyse de données.",
    target_audience: "Responsables marketing, Community managers, Chefs de projet digital",
    duration_days: 3,
    modules: ["IA & création de contenu (texte, image, vidéo)", "Ciblage et personnalisation par IA", "Analyse des sentiments et réputation", "Atelier : campagne marketing IA de A à Z"],
    min_participants: 8, max_participants: 25, base_price: 400000,
    tags: ["marketing", "digital", "contenu", "réseaux sociaux"]
  },
  {
    id: "ft-compta", code: "FT-COMPTA", title: "IA & Comptabilité", sector: "Comptabilité",
    description: "Automatisez la saisie, le rapprochement et le reporting comptable avec l'IA.",
    target_audience: "Comptables, Experts-comptables, Assistants comptables",
    duration_days: 3,
    modules: ["Automatisation de la saisie comptable", "IA & rapprochement bancaire", "Génération de rapports comptables", "Atelier : IA sur vos données SAGE/CIEL"],
    min_participants: 8, max_participants: 20, base_price: 380000,
    tags: ["comptabilité", "automatisation", "SAGE", "reporting"]
  },
  {
    id: "ft-enseignants", code: "FT-ENSEIGNANTS", title: "IA pour Enseignants", sector: "Éducation",
    description: "Intégrez l'IA dans vos pratiques pédagogiques pour engager et évaluer vos étudiants.",
    target_audience: "Enseignants, Formateurs, Directeurs d'établissements",
    duration_days: 3,
    modules: ["ChatGPT et outils IA pour la classe", "Création de cours et exercices avec IA", "Évaluation et feedback automatisés", "Atelier : construire un cours avec IA"],
    min_participants: 10, max_participants: 30, base_price: 350000,
    tags: ["éducation", "pédagogie", "ChatGPT", "enseignement"]
  },
  {
    id: "ft-secteur-pub", code: "FT-SECTEUR-PUB", title: "IA & Secteur Public", sector: "Administration",
    description: "Moderniser l'administration avec l'IA : e-gouvernance, services aux citoyens et transparence.",
    target_audience: "Fonctionnaires, Cadres de l'administration, Élus locaux",
    duration_days: 4,
    modules: ["IA & modernisation de l'État", "E-gouvernance et services numériques", "IA & prise de décision publique", "Gestion des données publiques", "Atelier : digitaliser un service administratif"],
    min_participants: 10, max_participants: 30, base_price: 450000,
    tags: ["administration", "e-gouvernance", "secteur public", "données"]
  },
  {
    id: "ft-startup", code: "FT-STARTUP", title: "IA pour Startups & PME", sector: "Entrepreneuriat",
    description: "Intégrez l'IA dans votre startup ou PME pour croître plus vite avec moins de ressources.",
    target_audience: "Fondateurs, Entrepreneurs, Gérants de PME",
    duration_days: 3,
    modules: ["IA pour automatiser votre startup", "Outils IA no-code pour PME", "IA & acquisition client", "Atelier : construire un MVP IA en 2h"],
    min_participants: 8, max_participants: 25, base_price: 420000,
    tags: ["startup", "PME", "no-code", "automatisation", "croissance"]
  },
  {
    id: "ft-logistique", code: "FT-LOGISTIQUE", title: "IA & Supply Chain", sector: "Logistique",
    description: "Optimisez votre chaîne logistique avec l'IA : prévision des stocks, routage et traçabilité.",
    target_audience: "Responsables logistique, Supply chain managers, Acheteurs",
    duration_days: 3,
    modules: ["IA & prévision des stocks", "Optimisation des routes et livraisons", "Traçabilité et IoT connecté à l'IA", "Atelier : optimiser votre flux logistique"],
    min_participants: 8, max_participants: 20, base_price: 400000,
    tags: ["logistique", "supply chain", "stocks", "optimisation"]
  },
  {
    id: "ft-banque", code: "FT-BANQUE", title: "IA & Banque / Assurance", sector: "Banque",
    description: "Transformez vos services bancaires et assurantiels avec l'IA : scoring, conformité et chatbots.",
    target_audience: "Banquiers, Agents d'assurance, Responsables conformité",
    duration_days: 5,
    modules: ["Scoring crédit et IA", "Détection de fraude temps réel", "Chatbots et service client IA", "Conformité réglementaire & IA", "Atelier : cas pratiques secteur bancaire CI"],
    min_participants: 8, max_participants: 20, base_price: 620000,
    tags: ["banque", "assurance", "scoring", "conformité", "chatbot"]
  },
];
