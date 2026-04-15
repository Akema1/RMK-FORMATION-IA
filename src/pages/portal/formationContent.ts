// ─────────────────────────────────────────────
// FORMATION CONTENT — gated curriculum data (confirmed participants only)
// ─────────────────────────────────────────────
import type { FormationContent } from './tokens';

export const FORMATION_CONTENT: Record<string, FormationContent> = {
  's1': {
    subtitle: 'IA & transformation du leadership — piloter avec vision a l\'ere de l\'intelligence artificielle',
    public_cible: 'PDG, DG, DGA, Directeurs generaux, Administrateurs',
    methodology: [
      'Demonstrations pratiques avec des outils IA en temps reel',
      'Ateliers de prompt engineering appliques a vos decisions',
      'Etudes de cas issus de dirigeants africains et internationaux',
      'Simulations de decisions strategiques augmentees par l\'IA',
    ],
    modules: [
      {
        title: 'IA & transformation du leadership et de la gouvernance',
        points: [
          'Panorama de l\'intelligence artificielle generative en 2026',
          'Impact de l\'IA sur le role du dirigeant et la gouvernance',
          'Opportunites et risques strategiques lies a l\'IA',
          'Cas concrets de transformation par l\'IA en Afrique et dans le monde',
        ],
      },
      {
        title: 'Prompt engineering strategique — maitriser l\'IA pour decider mieux',
        points: [
          'Fonctionnement des modeles d\'IA generative (ChatGPT, Gemini, Claude)',
          'Structure d\'un prompt efficace pour l\'analyse strategique',
          'Techniques pour obtenir des syntheses et recommandations fiables',
          'Atelier pratique : prompts pour vos enjeux de direction',
        ],
      },
      {
        title: 'Prise de decision augmentee : analyse, synthese et prospective',
        points: [
          'Utiliser l\'IA pour analyser des rapports et donnees complexes',
          'Synthese acceleree de documents strategiques avec l\'IA',
          'Simulation de scenarios et aide a la planification strategique',
          'Atelier : decision augmentee sur un cas reel de votre secteur',
        ],
      },
      {
        title: 'IA dans les fonctions cles de l\'entreprise',
        points: [
          'IA & finance : analyse financiere, controle de gestion augmente',
          'IA & RH : recrutement, gestion des talents, communication interne',
          'IA & juridique : analyse de contrats, conformite reglementaire',
          'IA & communication : redaction, image de marque, relation clients',
        ],
      },
      {
        title: 'Gouvernance IA, ethique et responsabilite du dirigeant',
        points: [
          'Cadre ethique et reglementaire de l\'IA (Union Africaine, UE)',
          'Responsabilite du dirigeant dans l\'usage de l\'IA',
          'Construire une politique d\'IA dans son organisation',
          'Prochaines etapes : plan d\'action personnalise post-formation',
        ],
      },
    ],
    cas_pratiques: [
      'Analyse strategique d\'un marche avec l\'IA',
      'Redaction d\'un memo de direction augmente par l\'IA',
      'Simulation de prise de decision dans un contexte de crise',
      'Construction d\'un plan de transformation digitale avec l\'IA',
    ],
    resultats: [
      'Comprendre les enjeux strategiques de l\'IA pour votre organisation',
      'Utiliser l\'IA generative comme outil de decision et de pilotage',
      'Maitriser le prompt engineering applique a la direction d\'entreprise',
      'Exploiter l\'IA dans les fonctions cles de votre organisation',
      'Construire une vision et une politique IA adaptees a votre contexte',
    ],
    formateur: {
      name: 'Djimtahadoum Memtingar',
      title: 'Expert-Consultant & Formateur en IA Generative',
      company: 'CABEXIA — Cabinet d\'Expertise en Intelligence Artificielle',
      citation: 'Avec CABEXIA, l\'intelligence artificielle ne reste pas une promesse : elle devient un outil concret de performance, d\'impact et de transformation.',
    },
  },
  's2': {
    subtitle: 'Analyse financiere augmentee et prise de decision strategique a l\'ere de l\'IA',
    public_cible: 'DAF, Analystes financiers, Professionnels bancaires, Responsables risques, Controleurs de gestion, Responsables conformite',
    methodology: [
      'Ateliers intensifs de prompting applique a la finance',
      'Etudes de cas inspirees de situations reelles de banques et entreprises',
      'Simulations d\'analyse financiere assistee par l\'IA',
      'Exercices de prise de decision financiere sur donnees reelles',
    ],
    modules: [
      {
        title: 'IA et transformation des metiers de la finance',
        points: [
          'Impact de l\'intelligence artificielle sur les institutions financieres',
          'Evolution du role des directions financieres a l\'ere de l\'IA',
          'Nouveaux outils d\'analyse economique et financiere disponibles',
          'Opportunites et limites de l\'IA dans la finance',
        ],
      },
      {
        title: 'Prompt engineering applique a l\'analyse financiere',
        points: [
          'Structure d\'un prompt efficace pour l\'analyse financiere',
          'Techniques pour obtenir des analyses financieres fiables et exploitables',
          'Construction de prompts pour interpreter des donnees economiques complexes',
          'Utilisation de l\'IA pour produire des rapports financiers de qualite',
        ],
      },
      {
        title: 'IA et analyse des etats financiers',
        points: [
          'Analyse automatisee des bilans et comptes de resultat',
          'Interpretation des indicateurs financiers cles avec l\'IA',
          'Identification des fragilites financieres d\'une entreprise',
          'Analyse de rentabilite et de performance augmentee par l\'IA',
        ],
      },
      {
        title: 'IA et gestion des risques financiers',
        points: [
          'Identification des risques financiers et operationnels avec l\'IA',
          'Analyse de la solvabilite d\'une entreprise assistee par l\'IA',
          'Evaluation des risques d\'investissement et de portefeuille',
          'Simulation de scenarios economiques et tests de resistance',
        ],
      },
      {
        title: 'IA et prise de decision financiere strategique',
        points: [
          'Analyse comparative de projets d\'investissement avec l\'IA',
          'Simulation de scenarios economiques et financiers complexes',
          'Identification des opportunites de croissance grace a l\'IA',
          'Aide a la decision strategique et reporting pour le comite de direction',
        ],
      },
      {
        title: 'IA et conformite financiere',
        points: [
          'Utilisation de l\'IA dans la conformite bancaire et reglementaire',
          'Analyse et veille sur les obligations reglementaires (BCEAO, COBAC)',
          'Surveillance des risques lies aux operations financieres',
          'Optimisation des processus de controle interne avec l\'IA',
        ],
      },
    ],
    cas_pratiques: [
      'Analyse de la situation financiere d\'une entreprise avec l\'IA',
      'Evaluation d\'un projet d\'investissement assistee par l\'IA',
      'Analyse d\'un risque de credit avec simulation IA',
      'Simulation d\'un choc economique sur une entreprise',
      'Analyse de la rentabilite d\'un portefeuille d\'activites',
      'Interpretation d\'indicateurs macroeconomiques UEMOA avec l\'IA',
    ],
    resultats: [
      'Utiliser l\'IA pour analyser et interpreter des donnees financieres complexes',
      'Maitriser les techniques de prompting appliquees a la finance',
      'Ameliorer la qualite et la rapidite de vos analyses financieres',
      'Renforcer la pertinence de vos decisions economiques et d\'investissement',
      'Identifier les opportunites d\'integration de l\'IA dans votre institution',
    ],
    formateur: {
      name: 'Djimtahadoum Memtingar',
      title: 'Expert-Consultant & Formateur en IA Generative',
      company: 'CABEXIA — Cabinet d\'Expertise en Intelligence Artificielle',
      citation: 'Avec CABEXIA, l\'intelligence artificielle ne reste pas une promesse : elle devient un outil concret de performance, d\'impact et de transformation.',
    },
  },
  's3': {
    subtitle: 'Augmenter la productivite et moderniser les etudes notariales grace a l\'IA',
    public_cible: 'Notaires, Clercs de notaires, Collaborateurs d\'etudes notariales, Juristes droit immobilier et successions',
    methodology: [
      'Approche pratique centree sur le prompt engineering juridique',
      'Ateliers d\'analyse de textes et de contrats juridiques reels',
      'Redaction assistee par IA d\'actes notarials et de courriers',
      'Simulations de cas notarials complexes (successions, transactions)',
    ],
    modules: [
      {
        title: 'Maitriser l\'IA et le prompt engineering juridique',
        points: [
          'Comprendre les capacites et limites des outils d\'IA pour le droit',
          'Panorama des outils d\'IA generative utilises dans le domaine juridique',
          'Fonctionnement des modeles d\'IA : ce qu\'ils peuvent et ne peuvent pas faire',
          'Applications concretes de l\'IA dans les activites notariales',
        ],
      },
      {
        title: 'Prompt engineering pour les notaires',
        points: [
          'Structure d\'un prompt juridique professionnel fiable',
          'Techniques permettant d\'obtenir des analyses juridiques exploitables',
          'Methodes pour analyser et interpreter des textes juridiques avec l\'IA',
          'Atelier : analyser un texte juridique et simplifier pour un client',
        ],
      },
      {
        title: 'IA et redaction des actes notarials',
        points: [
          'IA et redaction juridique assistee : principes et limites',
          'Redaction assistee d\'actes notarials avec controle de l\'expert',
          'Structuration et amelioration de la qualite redactionnelle',
          'Automatisation partielle de la preparation des actes courants',
        ],
      },
      {
        title: 'IA et analyse des contrats',
        points: [
          'Analyse rapide des clauses contractuelles avec l\'IA',
          'Identification des clauses sensibles ou risquees dans un contrat',
          'Evaluation des risques juridiques dans les contrats complexes',
          'Atelier : analyse d\'un contrat commercial ou immobilier',
        ],
      },
      {
        title: 'IA et preparation des dossiers notarials',
        points: [
          'Organisation et structuration intelligente des dossiers juridiques',
          'Analyse rapide de documents juridiques complexes avec l\'IA',
          'Preparation optimisee des consultations notariales',
          'Atelier : redaction d\'un projet d\'acte juridique assiste par IA',
        ],
      },
      {
        title: 'Modernisation des etudes notariales grace a l\'IA',
        points: [
          'Organisation et classement intelligent des documents juridiques',
          'Simplification des explications juridiques pour les clients',
          'Limites de l\'IA dans la pratique notariale : protection et responsabilite',
          'Construction de votre strategie d\'adoption de l\'IA dans votre etude',
        ],
      },
    ],
    cas_pratiques: [
      'Analyse d\'un contrat immobilier avec identification des risques',
      'Redaction d\'un projet d\'acte de vente assiste par l\'IA',
      'Identification des risques juridiques dans une transaction complexe',
      'Preparation d\'une consultation notariale grace a l\'IA',
      'Analyse d\'un dossier successoral avec synthese IA',
    ],
    resultats: [
      'Utiliser l\'IA dans vos activites notariales quotidiennes',
      'Maitriser les techniques de prompting juridique professionnel',
      'Ameliorer la redaction et la qualite de vos actes juridiques',
      'Optimiser la gestion et l\'organisation de vos dossiers notarials',
      'Renforcer la qualite du conseil juridique apporte a vos clients',
    ],
    formateur: {
      name: 'Djimtahadoum Memtingar',
      title: 'Expert-Consultant & Formateur en IA Generative',
      company: 'CABEXIA — Cabinet d\'Expertise en Intelligence Artificielle',
      citation: 'Avec CABEXIA, l\'intelligence artificielle ne reste pas une promesse : elle devient un outil concret de performance, d\'impact et de transformation.',
    },
  },
  's4': {
    subtitle: 'Transformer la fonction RH grace a l\'IA generative — recrutement, talents et pilotage strategique',
    public_cible: 'DRH, Responsables RH, Charges de recrutement, Responsables formation, Managers et responsables d\'equipe',
    methodology: [
      'Ateliers intensifs de prompting applique aux RH',
      'Exercices pratiques de redaction de documents RH avec l\'IA',
      'Simulations de situations manageriales augmentees par l\'IA',
      'Analyse de cas reels de gestion des ressources humaines',
    ],
    modules: [
      {
        title: 'IA et transformation de la fonction RH',
        points: [
          'Impact de l\'intelligence artificielle sur les metiers des ressources humaines',
          'Nouvelles competences attendues des responsables RH a l\'ere de l\'IA',
          'IA et transformation des organisations : role des RH dans la conduite du changement',
          'Panorama des outils IA pour les professionnels RH',
        ],
      },
      {
        title: 'Prompt engineering applique aux RH',
        points: [
          'Structure d\'un prompt professionnel pour les activites RH',
          'Techniques pour obtenir des reponses fiables et exploitables',
          'Construction de prompts pour les activites de gestion des talents',
          'Atelier : creer votre bibliotheque de prompts RH personnalises',
        ],
      },
      {
        title: 'IA et recrutement',
        points: [
          'Redaction d\'offres d\'emploi attractives et inclusives avec l\'IA',
          'Analyse et preselection de CV avec assistance IA',
          'Preparation et structuration d\'entretiens de recrutement',
          'Evaluation des competences et des candidats avec l\'IA',
        ],
      },
      {
        title: 'IA et gestion des talents',
        points: [
          'Identification des competences cles et cartographie des talents',
          'Evaluation des performances et feedback augmente par l\'IA',
          'Developpement de plans de carriere personnalises avec l\'IA',
          'Gestion et planification des formations avec assistance IA',
        ],
      },
      {
        title: 'IA et communication RH',
        points: [
          'Redaction de communications internes percutantes avec l\'IA',
          'Preparation de notes RH, policies et procedures assistee par IA',
          'Amelioration de la communication organisationnelle et du dialogue social',
          'Atelier : rediger une communication de crise RH avec l\'IA',
        ],
      },
      {
        title: 'IA et gestion strategique des ressources humaines',
        points: [
          'Analyse des besoins en competences et GPEC augmentee par l\'IA',
          'Planification strategique des ressources humaines avec l\'IA',
          'Accompagnement des transformations organisationnelles par les RH',
          'Construction de votre feuille de route RH & IA',
        ],
      },
    ],
    cas_pratiques: [
      'Redaction d\'une fiche de poste complete et attractive avec l\'IA',
      'Analyse et preselection de candidatures avec assistance IA',
      'Preparation d\'un entretien de recrutement structure',
      'Elaboration d\'un plan de formation annuel avec l\'IA',
      'Gestion d\'un conflit au sein d\'une equipe : analyse et plan d\'action IA',
      'Preparation d\'une communication interne sur une restructuration',
    ],
    resultats: [
      'Utiliser l\'IA dans toutes vos activites RH quotidiennes',
      'Maitriser les techniques de prompting appliquees aux ressources humaines',
      'Ameliorer la qualite et la rapidite de vos decisions RH',
      'Optimiser vos processus de recrutement et de gestion des talents',
      'Identifier les opportunites d\'integration de l\'IA dans votre organisation',
    ],
    formateur: {
      name: 'Djimtahadoum Memtingar',
      title: 'Expert-Consultant & Formateur en IA Generative',
      company: 'CABEXIA — Cabinet d\'Expertise en Intelligence Artificielle',
      citation: 'Avec CABEXIA, l\'intelligence artificielle ne reste pas une promesse : elle devient un outil concret de performance, d\'impact et de transformation.',
    },
  },
};
