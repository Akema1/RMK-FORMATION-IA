import { Seminar as BaseSeminar } from '../data/seminars';

// ─── Extended Seminar with flyer fields ───
export interface Seminar extends BaseSeminar {
  flyer_subtitle: string;
  flyer_highlight: string;
  flyer_bullets: string[];
  flyer_image: string;
}

// ─── Participant ───
export interface Participant {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  tel: string;
  societe: string;
  fonction: string;
  seminar: string;
  amount: number;
  status: 'pending' | 'confirmed' | 'cancelled';
  payment: string;
  notes: string;
  created_at: string;
}

// ─── Lead ───
export interface Lead {
  id: string;
  nom: string;
  contact: string;
  entreprise?: string;
  source: string;
  status: 'froid' | 'tiede' | 'chaud' | 'signé';
  notes: string;
  created_at: string;
}

// ─── Task ───
export interface Task {
  id: string;
  task: string;
  owner: string;
  deadline: string;
  seminar: string;
  priority: 'high' | 'medium' | 'low';
  status: 'todo' | 'progress' | 'done';
  created_at: string;
}

// ─── Expense ───
export interface Expense {
  id: string;
  label: string;
  amount: number;
  category: string;
  seminar: string;
  paid: boolean;
  created_at: string;
}

// ─── Budget Config ───
export interface BudgetConfig {
  consultance_pres: number;
  consultance_ligne: number;
  billet_avion: number;
  sejour: number;
  salle: number;
  pauses_cafe: number;
  dejeuner: number;
  supports: number;
  equipements: number;
  divers: number;
  transport: number;
  commercialisation_pct: number;
  [key: string]: number;
}

// ─── Per-Seminar Budget Configs ───
export type SeminarBudgetConfigs = Record<string, BudgetConfig>;

// ─── Prices ───
export interface Prices {
  standard: number;
  earlyBird: number;
  discountPct: number;
  dirigeants: number;
  coaching: number;
  packDiscount3: number;
  packDiscount2sem: number;
  packDiscount4sem: number;
}

// ─── Per-Seminar Pricing Overrides ───
export interface SeminarPricing {
  price: number;
  earlyBirdPct: number;
  coachingPrice: number;
  packDiscount3Enabled: boolean;
  packDiscount2semEnabled: boolean;
  packDiscount4semEnabled: boolean;
}

export type SeminarPricingConfigs = Record<string, SeminarPricing>;

// ─── Charges breakdown ───
export interface Charges {
  consultance_pres: number;
  consultance_ligne: number;
  billet_avion: number;
  sejour: number;
  salle: number;
  pauses_cafe: number;
  dejeuner: number;
  supports: number;
  equipements: number;
  divers: number;
  transport: number;
  commercialisation: number;
  [key: string]: number;
}

// ─── Financial calculation result ───
export interface FinancialResult {
  qtyStandard: number;
  qtyEarlyBird: number;
  totalPax: number;
  revStandard: number;
  revEarlyBird: number;
  totalRevenus: number;
  charges: Charges;
  totalCharges: number;
  revenuProv: number;
  imprevu: number;
  sousTotalBrut: number;
  tva: number;
  net: number;
}

// ─── Team Member ───
export interface TeamMember {
  id: string;
  name: string;
  role: string;           // Rôle court (Nav sidebar, TasksPage owner dropdown)
  avatar: string;         // Initiales (2 caractères)
  bio?: string;           // Description complète (brochure, portail coaching)
  expertise?: string[];   // Tags expertise
  email?: string;
  phone?: string;
}

// ─── History entry for AI agents ───
export interface AgentHistoryEntry {
  date: string;
  topic?: string;
  query?: string;
  seminar?: string;
  title?: string;
  result: string;
}

// ─── Venue (Hôtels & Salles) ───
export interface Venue {
  id: string;
  name: string;
  address: string;
  zone: string;
  stars: number;
  capacity_max: number;
  capacity_seminar: number;
  tarif_demi_journee: number;
  tarif_journee: number;
  tarif_semaine: number;
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  services: string[];
  notes: string;
}

// ─── Speaker (Intervenant) ───
export interface Speaker {
  id: string;
  name: string;
  title: string;
  company: string;
  expertise: string[];
  linkedin_url: string;
  email: string;
  phone: string;
  tarif_demi_journee: number;
  tarif_journee: number;
  disponible: boolean;
  langues: string[];
  note: string;
  avatar_initials: string;
  biography?: string;
  formations_history?: string[];
}

// ─── Formation Template (Catalogue) ───
export interface FormationTemplate {
  id: string;
  code: string;
  title: string;
  sector: string;
  description: string;
  target_audience: string;
  duration_days: number;
  modules: string[];
  min_participants: number;
  max_participants: number;
  base_price: number;
  tags: string[];
}
