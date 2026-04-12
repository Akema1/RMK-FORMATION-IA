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

// ─── Prices ───
export interface Prices {
  standard: number;
  earlyBird: number;
  discountPct: number;
}

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
  role: string;
  avatar: string;
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
