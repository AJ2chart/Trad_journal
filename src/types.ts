export type Side = 'long' | 'short';

export interface Trade {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM (optionnel) */
  time?: string;
  symbol: string;
  side: Side;
  qty: number;
  entry: number;
  /** null = trade encore ouvert */
  exit: number | null;
  stop?: number | null;
  target?: number | null;
  /** Frais fixes en devise */
  fees?: number;
  /** Frais en % du montant échangé (entrée + sortie) */
  feePct?: number;
  /** Valeur d'un point (futures, contrats). 1 par défaut. */
  multiplier?: number;
  setup?: string;
  reasonEntry?: string;
  reasonExit?: string;
  notes?: string;
  emotions?: string[];
  mistakes?: string[];
  followedPlan?: boolean | null;
  /** Qualité d'exécution 1..5 */
  rating?: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface TradeImage {
  id: string;
  tradeId: string;
  blob: Blob;
  caption?: string;
  createdAt: number;
}

export interface Lesson {
  id: string;
  title: string;
  content: string;
  category?: string;
  tradeIds: string[];
  createdAt: number;
  updatedAt: number;
}

export interface Settings {
  currency: string;
  defaultFees: number;
  /** Frais en % par défaut (crypto, actions) */
  defaultFeePct: number;
  defaultMultiplier: number;
}

export const DEFAULT_SETTINGS: Settings = {
  currency: '€',
  defaultFees: 0,
  defaultFeePct: 0,
  defaultMultiplier: 1,
};

export const EMOTIONS = [
  'Calme',
  'Confiant',
  'Concentré',
  'Hésitant',
  'Impatient',
  'FOMO',
  'Peur',
  'Revanche',
  'Euphorique',
  'Fatigué',
];

export const MISTAKES = [
  'Entrée trop tôt',
  'Entrée tardive',
  'Hors plan',
  'Pas de stop',
  'Stop déplacé',
  'Sortie trop tôt',
  'Sortie trop tard',
  'Taille trop grosse',
  'Overtrading',
  'Contre-tendance',
];
