// Barrel export for admin modules
export { Nav } from './Nav';
export { DashboardPage } from './DashboardPage';
export { SeoAgentPage } from './SeoAgentPage';
export { FlyerPage } from './FlyerPage';
export { SeminarsManagement } from './SeminarsManagement';
export { InscriptionsPage } from './InscriptionsPage';
export { FinancePage } from './FinancePage';
export { LeadsPage } from './LeadsPage';
export { TasksPage } from './TasksPage';
export { PricesPage } from './PricesPage';
export { AgentPage } from './AgentPage';
export { ResearchPage } from './ResearchPage';
export { FormationTrackingPage } from './FormationTrackingPage';
export { callGemini } from './callGemini';

export type {
  Seminar,
  Participant,
  Lead,
  Task,
  Expense,
  BudgetConfig,
  Prices,
  Charges,
  FinancialResult,
  TeamMember,
  AgentHistoryEntry,
} from './types';

export {
  DEFAULT_SEMINARS,
  DEFAULT_PRICES,
  DEFAULT_BUDGET_CONFIG,
  TEAM,
  EXPENSE_CATEGORIES,
  SURFACE_BG,
  ORANGE,
  card,
  inputS,
  selectS,
  btnPrimary,
  btnSecondary,
  badge,
  label,
} from './config';
